import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { ecomaison2026Bareme } from "../shared/ecomaison/generated/bareme-2026";
import {
	ECOMAISON_FAMILIES,
	type EcomaisonFamily,
	MATERIAL_TIERS,
	MOLTENI_CATEGORIES,
	type MaterialTier,
	SHOWROOM_KEY,
	ZONES,
	isMaterialAllowedWithDisruptors,
	isMaterialRequired,
	roundMoney,
} from "../shared/ecomaison/taxonomy";
import type { Doc, Id } from "./_generated/dataModel";
import {
	type MutationCtx,
	type QueryCtx,
	mutation,
	query,
} from "./_generated/server";
import {
	getCompositionInScope,
	getProductInScope,
	requireProductInScope,
	requireProductScope,
	requireVariantInScope,
} from "./productScope";

const categoryValidator = v.union(
	...MOLTENI_CATEGORIES.map((category) => v.literal(category)),
);
const familyValidator = v.union(
	...ECOMAISON_FAMILIES.map((family) => v.literal(family)),
);
const materialTierValidator = v.union(
	...MATERIAL_TIERS.map((tier) => v.literal(tier.key)),
);
const zoneValidator = v.union(...ZONES.map((zone) => v.literal(zone)));
const moduleKindValidator = v.union(v.literal("base"), v.literal("component"));
const productTypeFilterValidator = v.union(
	v.literal("all"),
	v.literal("standalone"),
	v.literal("composition"),
	v.literal("module"),
);
const productStatusFilterValidator = v.union(
	v.literal("all"),
	v.literal("calculated"),
	v.literal("incomplete"),
	v.literal("sold"),
);
const compositionItemInputValidator = v.object({
	moduleProductId: v.id("products"),
	variantId: v.id("productVariants"),
	quantity: v.number(),
});
const BASE_MODULE_NAME = "Base / Structure";
const MAX_PRODUCT_PAGE_SIZE = 100;
const PRODUCT_FILTER_READ_LIMIT = 1000;

type StaticBaremeEntry = {
	family: string;
	materialTier?: string;
	measurementKind?: string;
	weightMin?: number;
	weightMax?: number;
	widthMin?: number;
	widthMax?: number;
	rateHt: number;
	rateHtDurable?: number;
	label: string;
	officialProductCode?: string;
};

/**
 * Returns dashboard inventory health for the authenticated showroom workspace.
 */
export const getDashboard = query({
	args: {},
	handler: async (ctx) => {
		const scope = await requireProductScope(ctx);
		const products = await getActiveProducts(ctx, scope.organizationId);
		const variants = await getVariantsForProducts(ctx, products);
		const rows = products.map((product) =>
			toProductRow(product, variants.get(product._id) ?? []),
		);
		const totalProducts = rows.length;
		const calculated = rows.filter((row) => row.status === "calculated").length;
		const missingWeight = rows.filter((row) =>
			row.missingFields.includes("weight"),
		).length;
		const missingMaterial = rows.filter((row) =>
			row.missingFields.includes("material"),
		).length;
		const byCategory = MOLTENI_CATEGORIES.map((category) => {
			const categoryRows = rows.filter(
				(row) => row.molteniCategory === category,
			);
			const categoryCalculated = categoryRows.filter(
				(row) => row.status === "calculated",
			).length;
			return {
				category,
				total: categoryRows.length,
				calculated: categoryCalculated,
				percent: percent(categoryCalculated, categoryRows.length),
			};
		}).filter((row) => row.total > 0);

		return {
			stats: {
				totalProducts,
				calculated,
				calculatedPercent: percent(calculated, totalProducts),
				missingWeight,
				missingMaterial,
			},
			byCategory,
			attention: rows
				.filter((row) => row.status !== "calculated")
				.sort((a, b) => b.missingFields.length - a.missingFields.length)
				.slice(0, 12),
		};
	},
});

/**
 * Lists active products with their default variant summary.
 */
export const listProducts = query({
	args: {
		search: v.optional(v.string()),
		zone: v.optional(zoneValidator),
		category: v.optional(categoryValidator),
		type: v.optional(productTypeFilterValidator),
		status: v.optional(productStatusFilterValidator),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const products = await getActiveProducts(ctx, scope.organizationId);
		const variants = await getVariantsForProducts(ctx, products);
		const parentNames = await getParentNames(
			ctx,
			products,
			scope.organizationId,
		);
		const rows = products.map((product) => ({
			...toProductRow(product, variants.get(product._id) ?? []),
			parentName: product.parentId
				? (parentNames.get(product.parentId) ?? null)
				: null,
		}));

		return rows
			.filter((row) => row.moduleKind !== "base")
			.filter((row) => matchesSearch(row, args.search))
			.filter((row) => !args.zone || row.zone === args.zone)
			.filter((row) => !args.category || row.molteniCategory === args.category)
			.filter(
				(row) => !args.type || args.type === "all" || row.type === args.type,
			)
			.filter((row) => matchesStatus(row, args.status))
			.slice(0, 200);
	},
});

/**
 * Returns one filtered product table page plus visible count metadata.
 */
export const listProductsPage = query({
	args: {
		search: v.optional(v.string()),
		zone: v.optional(v.union(v.literal("all"), zoneValidator)),
		category: v.optional(v.union(v.literal("all"), categoryValidator)),
		type: v.optional(productTypeFilterValidator),
		status: v.optional(productStatusFilterValidator),
		page: v.number(),
		pageSize: v.number(),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const pageSize = normalizePageSize(args.pageSize);
		const page = normalizePage(args.page);

		const zone = args.zone === "all" ? undefined : args.zone;
		const category = args.category === "all" ? undefined : args.category;
		const products = await getFilteredProductCandidates(ctx, {
			category,
			organizationId: scope.organizationId,
			zone,
		});
		const variants = await getVariantsForProducts(ctx, products);
		const parentNames = await getParentNames(
			ctx,
			products,
			scope.organizationId,
		);
		const rows = products
			.map((product) => ({
				...toProductRow(product, variants.get(product._id) ?? []),
				parentName: product.parentId
					? (parentNames.get(product.parentId) ?? null)
					: null,
			}))
			.filter((row) => row.moduleKind !== "base")
			.filter((row) => matchesSearch(row, args.search))
			.filter((row) => !zone || row.zone === zone)
			.filter((row) => !category || row.molteniCategory === category)
			.filter(
				(row) => !args.type || args.type === "all" || row.type === args.type,
			)
			.filter((row) => matchesStatus(row, args.status));

		const totalCount = rows.length;
		const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
		const boundedPage = Math.min(page, totalPages - 1);
		const startOffset = boundedPage * pageSize;
		const pageRows = rows.slice(startOffset, startOffset + pageSize);
		const endIndex = startOffset + pageRows.length;

		return {
			rows: pageRows,
			page: boundedPage,
			pageSize,
			totalCount,
			totalPages,
			startIndex: totalCount === 0 ? 0 : startOffset + 1,
			endIndex,
			hasPreviousPage: boundedPage > 0,
			hasNextPage: endIndex < totalCount,
		};
	},
});

/**
 * Returns a live, cursor-paginated product page for the inventory table.
 */
export const listProductsPaginated = query({
	args: {
		paginationOpts: paginationOptsValidator,
		search: v.optional(v.string()),
		zone: v.optional(v.union(v.literal("all"), zoneValidator)),
		category: v.optional(v.union(v.literal("all"), categoryValidator)),
		type: v.optional(productTypeFilterValidator),
		status: v.optional(productStatusFilterValidator),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);

		const zone = args.zone === "all" ? undefined : args.zone;
		const category = args.category === "all" ? undefined : args.category;
		const productsPage = await paginateActiveProducts(ctx, {
			category,
			organizationId: scope.organizationId,
			paginationOpts: args.paginationOpts,
			zone,
		});
		const variants = await getVariantsForProducts(ctx, productsPage.page);
		const parentNames = await getParentNames(
			ctx,
			productsPage.page,
			scope.organizationId,
		);
		const rows = productsPage.page.map((product) => ({
			...toProductRow(product, variants.get(product._id) ?? []),
			parentName: product.parentId
				? (parentNames.get(product.parentId) ?? null)
				: null,
		}));

		return {
			...productsPage,
			page: rows
				.filter((row) => row.moduleKind !== "base")
				.filter((row) => matchesSearch(row, args.search))
				.filter((row) => !zone || row.zone === zone)
				.filter((row) => !category || row.molteniCategory === category)
				.filter(
					(row) => !args.type || args.type === "all" || row.type === args.type,
				)
				.filter((row) => matchesStatus(row, args.status)),
		};
	},
});

/**
 * Loads one product with variants, modules, and calculation details.
 */
export const getProduct = query({
	args: { productId: v.id("products") },
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const product = await getProductInScope(
			ctx,
			args.productId,
			scope.organizationId,
		);
		if (!product) return null;

		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", product._id))
			.take(50);
		const children = await ctx.db
			.query("products")
			.withIndex("by_parent", (q) => q.eq("parentId", product._id))
			.take(100);
		const activeChildren = children.filter(
			(child) =>
				child.status !== "deleted" &&
				child.organizationId === scope.organizationId,
		);
		const childVariants = await getVariantsForProducts(ctx, activeChildren);
		const childRows = activeChildren.map((child) =>
			toProductRow(child, childVariants.get(child._id) ?? []),
		);
		const baseModule =
			childRows.find((child) => child.moduleKind === "base") ?? null;
		const modules = childRows.filter((child) => child.moduleKind !== "base");
		const parent = product.parentId
			? await getProductInScope(ctx, product.parentId, scope.organizationId)
			: null;
		const totalRows = baseModule ? [baseModule, ...modules] : modules;
		const savedCompositions = product.isComposition
			? await getSavedCompositions(ctx, product._id)
			: [];

		return {
			product: serializeProduct(product),
			parent: parent ? serializeProduct(parent) : null,
			variants,
			baseModule,
			modules,
			savedCompositions,
			totalEcoHt: sumKnown(
				totalRows.map((module) => module.ecoParticipationHt),
			),
			totalEcoTtc: sumKnown(
				totalRows.map((module) => module.ecoParticipationTtc),
			),
		};
	},
});

/**
 * Returns quarterly declaration rows for sold products.
 */
export const getDeclaration = query({
	args: {
		year: v.number(),
		quarter: v.union(
			v.literal("T1"),
			v.literal("T2"),
			v.literal("T3"),
			v.literal("T4"),
		),
		soldOnly: v.boolean(),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const products = await getActiveProducts(ctx, scope.organizationId);
		const variants = await getVariantsForProducts(ctx, products);
		const range = getQuarterRange(args.year, args.quarter);
		const rows = products
			.map((product) => toProductRow(product, variants.get(product._id) ?? []))
			.filter((row) => {
				if (!args.soldOnly) return true;
				return Boolean(
					row.soldDate &&
						row.soldDate >= range.start &&
						row.soldDate <= range.end,
				);
			});
		const byFamily = ECOMAISON_FAMILIES.map((family) => {
			const familyRows = rows.filter((row) => row.ecomaisonFamily === family);
			return {
				family,
				count: familyRows.length,
				weightKg: sumKnown(familyRows.map((row) => row.weightKg)),
				ecoHt: sumKnown(familyRows.map((row) => row.ecoParticipationHt)),
				ecoTtc: sumKnown(familyRows.map((row) => row.ecoParticipationTtc)),
			};
		}).filter((row) => row.count > 0);

		return {
			stats: {
				count: rows.length,
				weightKg: sumKnown(rows.map((row) => row.weightKg)),
				ecoHt: sumKnown(rows.map((row) => row.ecoParticipationHt)),
				ecoTtc: sumKnown(rows.map((row) => row.ecoParticipationTtc)),
			},
			byFamily,
			rows,
		};
	},
});

/**
 * Creates a product and its default variant, recalculating immediately.
 */
export const createProduct = mutation({
	args: {
		name: v.string(),
		variantLabel: v.optional(v.string()),
		reference: v.optional(v.string()),
		zone: v.optional(zoneValidator),
		molteniCategory: categoryValidator,
		ecomaisonFamily: familyValidator,
		materialTier: v.optional(materialTierValidator),
		isComposition: v.boolean(),
		parentId: v.optional(v.id("products")),
		moduleKind: v.optional(moduleKindValidator),
		notes: v.optional(v.string()),
		hasRecyclingDisruptors: v.optional(v.boolean()),
		sustainableCertified: v.optional(v.boolean()),
		evolutionaryDesign: v.optional(v.boolean()),
		weightKg: v.optional(v.number()),
		widthCm: v.optional(v.number()),
		textileMode: v.optional(v.string()),
		priceHt: v.optional(v.number()),
		fabricReference: v.optional(v.string()),
		tvaRate: v.number(),
		createBaseModule: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		validateProductInput(args);
		const showroom = await getOrCreateShowroom(ctx, Date.now());
		const now = Date.now();
		const isComposition = args.isComposition && !args.parentId;
		const parentProduct = args.parentId
			? await requireProductInScope(ctx, args.parentId, scope.organizationId)
			: null;
		const productId = await ctx.db.insert("products", {
			name: args.name.trim(),
			molteniCategory: args.molteniCategory,
			ecomaisonFamily: args.ecomaisonFamily,
			materialTier: getStoredMaterialTier(args),
			zone: args.zone,
			hasRecyclingDisruptors: isComposition
				? undefined
				: (args.hasRecyclingDisruptors ?? false),
			sustainableCertified: isComposition
				? undefined
				: (args.sustainableCertified ?? false),
			evolutionaryDesign: isComposition
				? undefined
				: (args.evolutionaryDesign ?? false),
			isComposition,
			moduleKind: args.parentId ? (args.moduleKind ?? "component") : undefined,
			parentId: args.parentId,
			showroomId: parentProduct?.showroomId ?? showroom._id,
			organizationId: scope.organizationId,
			notes: normalizeOptional(args.notes),
			status: "active",
			tvaRate: args.tvaRate,
			createdByUserId: scope.userId,
			createdAt: now,
			updatedAt: now,
		});

		if (!isComposition) {
			const calculation = await calculateVariant(ctx, {
				product: await ctx.db.get(productId),
				weightKg: args.weightKg,
				widthCm: args.widthCm,
				textileMode: args.textileMode,
				tvaRate: args.tvaRate,
			});

			await ctx.db.insert("productVariants", {
				productId,
				variantLabel: normalizeVariantLabel(args.variantLabel),
				reference: normalizeOptional(args.reference),
				fabricReference: normalizeOptional(args.fabricReference),
				priceHt: args.priceHt,
				weightKg: args.weightKg,
				widthCm: args.widthCm,
				textileMode: args.textileMode,
				ecoParticipationHt: calculation?.ecoHt,
				ecoParticipationTtc: calculation?.ecoTtc,
				ecomaisonCode11: calculation?.officialProductCode,
				isEcomaisonCodeManual: false,
				createdAt: now,
				updatedAt: now,
			});
		}

		if (isComposition && args.createBaseModule) {
			await createBaseModule(ctx, {
				parentProductId: productId,
				organizationId: scope.organizationId,
				source: args,
				showroomId: showroom._id,
				userId: scope.userId,
				now,
			});
		}

		return productId;
	},
});

/**
 * Updates product-level classification and the exhibited configuration.
 */
export const updateProduct = mutation({
	args: {
		productId: v.id("products"),
		name: v.string(),
		variantLabel: v.optional(v.string()),
		reference: v.optional(v.string()),
		zone: v.optional(zoneValidator),
		molteniCategory: categoryValidator,
		ecomaisonFamily: familyValidator,
		materialTier: v.optional(materialTierValidator),
		isComposition: v.boolean(),
		notes: v.optional(v.string()),
		hasRecyclingDisruptors: v.optional(v.boolean()),
		sustainableCertified: v.optional(v.boolean()),
		evolutionaryDesign: v.optional(v.boolean()),
		weightKg: v.optional(v.number()),
		widthCm: v.optional(v.number()),
		textileMode: v.optional(v.string()),
		priceHt: v.optional(v.number()),
		fabricReference: v.optional(v.string()),
		tvaRate: v.number(),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		validateProductInput(args);
		const product = await requireProductInScope(
			ctx,
			args.productId,
			scope.organizationId,
		);

		const now = Date.now();
		const isComposition = args.isComposition && !product.parentId;
		await ctx.db.patch(args.productId, {
			name: args.name.trim(),
			molteniCategory: args.molteniCategory,
			ecomaisonFamily: args.ecomaisonFamily,
			materialTier: getStoredMaterialTier(args),
			zone: args.zone,
			hasRecyclingDisruptors: isComposition
				? undefined
				: (args.hasRecyclingDisruptors ?? false),
			sustainableCertified: isComposition
				? undefined
				: (args.sustainableCertified ?? false),
			evolutionaryDesign: isComposition
				? undefined
				: (args.evolutionaryDesign ?? false),
			isComposition,
			notes: normalizeOptional(args.notes),
			tvaRate: args.tvaRate,
			updatedAt: now,
		});

		if (isComposition) {
			return null;
		}

		const updatedProduct = await ctx.db.get(args.productId);
		const calculation = await calculateVariant(ctx, {
			product: updatedProduct,
			weightKg: args.weightKg,
			widthCm: args.widthCm,
			textileMode: args.textileMode,
			tvaRate: args.tvaRate,
		});
		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", args.productId))
			.take(1);
		const variantPatch = {
			reference: normalizeOptional(args.reference),
			fabricReference: normalizeOptional(args.fabricReference),
			priceHt: args.priceHt,
			weightKg: args.weightKg,
			widthCm: args.widthCm,
			textileMode: args.textileMode,
			ecoParticipationHt: calculation?.ecoHt,
			ecoParticipationTtc: calculation?.ecoTtc,
			ecomaisonCode11: calculation?.officialProductCode,
			updatedAt: now,
		};
		const existingVariantPatch = args.variantLabel
			? {
					...variantPatch,
					variantLabel: normalizeVariantLabel(args.variantLabel),
				}
			: variantPatch;

		if (variants[0]) {
			await ctx.db.patch(variants[0]._id, existingVariantPatch);
			return null;
		}

		await ctx.db.insert("productVariants", {
			productId: args.productId,
			variantLabel: normalizeVariantLabel(args.variantLabel),
			...variantPatch,
			isEcomaisonCodeManual: false,
			createdAt: now,
		});
		return null;
	},
});

/**
 * Adds a variant to an existing product and calculates it against the active
 * barème. Missing official rates stay null instead of pretending to be zero.
 */
export const addVariant = mutation({
	args: {
		productId: v.id("products"),
		variantLabel: v.string(),
		reference: v.optional(v.string()),
		fabricReference: v.optional(v.string()),
		priceHt: v.optional(v.number()),
		weightKg: v.optional(v.number()),
		widthCm: v.optional(v.number()),
		textileMode: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const product = await requireProductInScope(
			ctx,
			args.productId,
			scope.organizationId,
		);
		if (product.isComposition) {
			throw new Error("Composition products use modules, not variants");
		}
		if (!args.variantLabel.trim()) throw new Error("Variant label is required");

		const now = Date.now();
		const calculation = await calculateVariant(ctx, {
			product,
			weightKg: args.weightKg,
			widthCm: args.widthCm,
			textileMode: args.textileMode,
			tvaRate: product.tvaRate,
		});
		return await ctx.db.insert("productVariants", {
			productId: product._id,
			variantLabel: args.variantLabel.trim(),
			reference: normalizeOptional(args.reference),
			fabricReference: normalizeOptional(args.fabricReference),
			priceHt: args.priceHt,
			weightKg: args.weightKg,
			widthCm: args.widthCm,
			textileMode: args.textileMode,
			ecoParticipationHt: calculation?.ecoHt,
			ecoParticipationTtc: calculation?.ecoTtc,
			ecomaisonCode11: calculation?.officialProductCode,
			isEcomaisonCodeManual: false,
			createdAt: now,
			updatedAt: now,
		});
	},
});

/**
 * Updates a variant and recalculates its eco-participation using the current
 * product classification.
 */
export const updateVariant = mutation({
	args: {
		variantId: v.id("productVariants"),
		variantLabel: v.string(),
		reference: v.optional(v.string()),
		fabricReference: v.optional(v.string()),
		priceHt: v.optional(v.number()),
		weightKg: v.optional(v.number()),
		widthCm: v.optional(v.number()),
		textileMode: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const { product, variant } = await requireVariantInScope(
			ctx,
			args.variantId,
			scope.organizationId,
		);
		if (product.isComposition) {
			throw new Error("Composition products use modules, not variants");
		}
		if (!args.variantLabel.trim()) throw new Error("Variant label is required");

		const calculation = await calculateVariant(ctx, {
			product,
			weightKg: args.weightKg,
			widthCm: args.widthCm,
			textileMode: args.textileMode,
			tvaRate: product.tvaRate,
		});
		await ctx.db.patch(args.variantId, {
			variantLabel: args.variantLabel.trim(),
			reference: normalizeOptional(args.reference),
			fabricReference: normalizeOptional(args.fabricReference),
			priceHt: args.priceHt,
			weightKg: args.weightKg,
			widthCm: args.widthCm,
			textileMode: args.textileMode,
			ecoParticipationHt: calculation?.ecoHt,
			ecoParticipationTtc: calculation?.ecoTtc,
			ecomaisonCode11: calculation?.officialProductCode,
			updatedAt: Date.now(),
		});
		return null;
	},
});

/**
 * Removes a variant from a non-composition product. A product keeps at least
 * one variant because standalone products are represented by a default variant.
 */
export const deleteVariant = mutation({
	args: { variantId: v.id("productVariants") },
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const variant = await ctx.db.get(args.variantId);
		if (!variant) return null;
		const product = await requireProductInScope(
			ctx,
			variant.productId,
			scope.organizationId,
		);
		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", product._id))
			.take(2);
		if (variants.length <= 1) {
			throw new Error("A product must keep at least one variant");
		}
		await ctx.db.delete(args.variantId);
		return null;
	},
});

/**
 * Stores a manual Ecomaison code override. The app flags it as manual because
 * the official generator mappings are external data, not application logic.
 */
export const setManualEcomaisonCode = mutation({
	args: {
		variantId: v.id("productVariants"),
		code: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const { variant } = await requireVariantInScope(
			ctx,
			args.variantId,
			scope.organizationId,
		);
		const normalized = args.code?.trim();
		if (normalized && !/^\d{11}$/.test(normalized)) {
			throw new Error("Ecomaison code must contain exactly 11 digits");
		}
		await ctx.db.patch(variant._id, {
			isEcomaisonCodeManual: Boolean(normalized),
			manualEcomaisonCode11: normalized || undefined,
			updatedAt: Date.now(),
		});
		return null;
	},
});

/**
 * Soft-deletes a product. Recovery stays possible from Convex for now; the
 * product disappears from active inventory and declaration screens immediately.
 */
export const softDeleteProduct = mutation({
	args: { productId: v.id("products") },
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		await requireProductInScope(ctx, args.productId, scope.organizationId);
		await ctx.db.patch(args.productId, {
			status: "deleted",
			updatedAt: Date.now(),
		});
		return null;
	},
});

/**
 * Marks the whole exhibited product as sold or unsold.
 */
export const setSoldDate = mutation({
	args: {
		productId: v.id("products"),
		soldDate: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		await requireProductInScope(ctx, args.productId, scope.organizationId);
		await ctx.db.patch(args.productId, {
			soldDate: args.soldDate ?? undefined,
			updatedAt: Date.now(),
		});
		return null;
	},
});

/**
 * Saves a named composition configuration made from selected module variants.
 * Snapshot fields keep the saved total stable if modules change later.
 */
export const createProductComposition = mutation({
	args: {
		productId: v.id("products"),
		name: v.string(),
		notes: v.optional(v.string()),
		items: v.array(compositionItemInputValidator),
	},
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const name = args.name.trim();
		if (!name) throw new Error("Composition name is required");
		if (args.items.length === 0) {
			throw new Error("Select at least one module to save a composition");
		}

		const product = await requireProductInScope(
			ctx,
			args.productId,
			scope.organizationId,
		);
		if (!product.isComposition) {
			throw new Error("Composition product not found");
		}

		const snapshotItems = await Promise.all(
			args.items.map(async (item, position) => {
				if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
					throw new Error("Quantity must be greater than zero");
				}
				const moduleProduct = await ctx.db.get(item.moduleProductId);
				if (
					!moduleProduct ||
					moduleProduct.status === "deleted" ||
					moduleProduct.parentId !== product._id ||
					moduleProduct.organizationId !== scope.organizationId
				) {
					throw new Error("Selected module does not belong to this product");
				}
				const variant = await ctx.db.get(item.variantId);
				if (!variant || variant.productId !== moduleProduct._id) {
					throw new Error("Selected variant does not belong to this module");
				}
				return {
					moduleProduct,
					position,
					quantity: Math.max(1, Math.floor(item.quantity)),
					variant,
				};
			}),
		);

		const now = Date.now();
		const compositionId = await ctx.db.insert("productCompositions", {
			productId: product._id,
			name,
			notes: normalizeOptional(args.notes),
			createdAt: now,
			updatedAt: now,
		});

		await Promise.all(
			snapshotItems.map(({ moduleProduct, position, quantity, variant }) =>
				ctx.db.insert("productCompositionItems", {
					compositionId,
					moduleProductId: moduleProduct._id,
					variantId: variant._id,
					quantity,
					position,
					moduleName: moduleProduct.name,
					moduleKind: moduleProduct.moduleKind ?? "component",
					variantLabel: variant.variantLabel,
					priceHt: variant.priceHt,
					ecoParticipationHt: variant.ecoParticipationHt,
					ecoParticipationTtc: variant.ecoParticipationTtc,
					weightKg: variant.weightKg,
					widthCm: variant.widthCm,
					textileMode: variant.textileMode,
					ecomaisonCode11:
						variant.manualEcomaisonCode11 ?? variant.ecomaisonCode11,
					createdAt: now,
				}),
			),
		);

		return compositionId;
	},
});

/**
 * Removes a saved composition configuration without deleting its modules.
 */
export const deleteProductComposition = mutation({
	args: { compositionId: v.id("productCompositions") },
	handler: async (ctx, args) => {
		const scope = await requireProductScope(ctx);
		const entry = await getCompositionInScope(
			ctx,
			args.compositionId,
			scope.organizationId,
		);
		if (!entry) return null;
		const items = await ctx.db
			.query("productCompositionItems")
			.withIndex("by_composition", (q) =>
				q.eq("compositionId", args.compositionId),
			)
			.take(500);
		await Promise.all(items.map((item) => ctx.db.delete(item._id)));
		await ctx.db.delete(args.compositionId);
		return null;
	},
});

async function getShowroom(ctx: QueryOrMutationCtx) {
	return await ctx.db
		.query("showrooms")
		.withIndex("by_key", (q) => q.eq("key", SHOWROOM_KEY))
		.unique();
}

async function getOrCreateShowroom(ctx: MutationCtx, _now: number) {
	const existing = await getShowroom(ctx);
	if (existing) return existing;

	const showroomId = await ctx.db.insert("showrooms", {
		key: SHOWROOM_KEY,
		name: "Lyon",
		isActive: true,
	});
	const showroom = await ctx.db.get(showroomId);
	if (!showroom) throw new Error("Failed to create showroom");
	return showroom;
}

async function createBaseModule(
	ctx: MutationCtx,
	args: {
		now: number;
		organizationId: string;
		parentProductId: Id<"products">;
		showroomId: Id<"showrooms">;
		source: {
			ecomaisonFamily: EcomaisonFamily;
			materialTier?: MaterialTier;
			molteniCategory: (typeof MOLTENI_CATEGORIES)[number];
			priceHt?: number;
			textileMode?: string;
			tvaRate: number;
			weightKg?: number;
			widthCm?: number;
			zone?: (typeof ZONES)[number];
		};
		userId: Id<"users">;
	},
) {
	const children = await ctx.db
		.query("products")
		.withIndex("by_parent", (q) => q.eq("parentId", args.parentProductId))
		.take(100);
	const existingBase = children.find(
		(product) => product.moduleKind === "base" && product.status !== "deleted",
	);
	if (existingBase) return existingBase._id;

	const baseProductId = await ctx.db.insert("products", {
		name: BASE_MODULE_NAME,
		molteniCategory: args.source.molteniCategory,
		ecomaisonFamily: args.source.ecomaisonFamily,
		materialTier: getStoredMaterialTier({
			ecomaisonFamily: args.source.ecomaisonFamily,
			isComposition: false,
			materialTier: args.source.materialTier,
		}),
		zone: args.source.zone,
		hasRecyclingDisruptors: false,
		sustainableCertified: false,
		evolutionaryDesign: false,
		isComposition: false,
		moduleKind: "base",
		parentId: args.parentProductId,
		showroomId: args.showroomId,
		organizationId: args.organizationId,
		notes: "Base obligatoire de la composition.",
		status: "active",
		tvaRate: args.source.tvaRate,
		createdByUserId: args.userId,
		createdAt: args.now,
		updatedAt: args.now,
	});
	const baseProduct = await ctx.db.get(baseProductId);
	const calculation = await calculateVariant(ctx, {
		product: baseProduct,
		weightKg: args.source.weightKg,
		widthCm: args.source.widthCm,
		textileMode: args.source.textileMode,
		tvaRate: args.source.tvaRate,
	});

	await ctx.db.insert("productVariants", {
		productId: baseProductId,
		variantLabel: "Configuration exposée",
		priceHt: args.source.priceHt,
		weightKg: args.source.weightKg,
		widthCm: args.source.widthCm,
		textileMode: args.source.textileMode,
		ecoParticipationHt: calculation?.ecoHt,
		ecoParticipationTtc: calculation?.ecoTtc,
		ecomaisonCode11: calculation?.officialProductCode,
		isEcomaisonCodeManual: false,
		createdAt: args.now,
		updatedAt: args.now,
	});

	return baseProductId;
}

async function calculateVariant(
	ctx: QueryOrMutationCtx,
	args: {
		product: Doc<"products"> | null;
		weightKg: number | undefined;
		widthCm: number | undefined;
		textileMode: string | undefined;
		tvaRate: number;
	},
) {
	const { product, textileMode, weightKg, widthCm } = args;
	if (!product || product.isComposition) return null;
	if (isMaterialRequired(product.ecomaisonFamily as EcomaisonFamily)) {
		if (weightKg === undefined) return null;
		if (!product.materialTier) return null;
		if (
			!isMaterialAllowedWithDisruptors(
				product.materialTier as MaterialTier,
				product.hasRecyclingDisruptors ?? false,
			)
		) {
			return null;
		}
	}
	if (
		product.ecomaisonFamily === "Siège avec rembourrage" &&
		weightKg === undefined
	) {
		return null;
	}
	if (
		product.ecomaisonFamily === "Décoration textile" &&
		weightKg === undefined
	) {
		return null;
	}
	if (
		product.ecomaisonFamily === "Décoration textile" &&
		textileMode === "surface" &&
		(!weightKg || weightKg <= 0)
	) {
		return null;
	}
	if (product.ecomaisonFamily === "Literie" && widthCm === undefined) {
		return null;
	}

	const entries = (
		ecomaison2026Bareme.entries as readonly StaticBaremeEntry[]
	).filter((candidate) => {
		if (candidate.family !== product.ecomaisonFamily) return false;
		if (product.ecomaisonFamily === "Siège avec rembourrage") return true;
		if (product.ecomaisonFamily === "Literie") return true;
		if (product.ecomaisonFamily === "Décoration textile") return true;
		return candidate.materialTier === product.materialTier;
	});
	const entry = entries.find((candidate) => {
		if (product.ecomaisonFamily === "Literie") {
			if (candidate.widthMin === undefined || widthCm === undefined)
				return false;
			const max = candidate.widthMax ?? Number.POSITIVE_INFINITY;
			return widthCm > candidate.widthMin && widthCm <= max;
		}
		if (product.ecomaisonFamily === "Décoration textile") {
			const measurementKind = textileMode === "surface" ? "surface" : "weight";
			if (candidate.measurementKind !== measurementKind) return false;
			if (measurementKind === "surface") return true;
		}
		if (candidate.weightMin === undefined || weightKg === undefined)
			return false;
		const max = candidate.weightMax ?? Number.POSITIVE_INFINITY;
		return weightKg >= candidate.weightMin && weightKg < max;
	});
	if (!entry) return null;

	const isEcoModulationAllowed = !product.hasRecyclingDisruptors;
	const baseRate =
		product.sustainableCertified && isEcoModulationAllowed
			? (entry.rateHtDurable ?? entry.rateHt)
			: entry.rateHt;
	const rateMultiplier =
		product.ecomaisonFamily === "Décoration textile" &&
		textileMode === "surface"
			? (weightKg ?? 0)
			: 1;
	const ecoHt = roundMoney(
		(product.evolutionaryDesign && isEcoModulationAllowed
			? baseRate * 0.85
			: baseRate) * rateMultiplier,
	);
	return {
		ecoHt,
		ecoTtc: roundMoney(ecoHt * (1 + args.tvaRate)),
		label: entry.label,
		officialProductCode: entry.officialProductCode,
	};
}

async function getActiveProducts(
	ctx: QueryOrMutationCtx,
	organizationId: string,
) {
	return await ctx.db
		.query("products")
		.withIndex("by_organization_and_status", (q) =>
			q.eq("organizationId", organizationId).eq("status", "active"),
		)
		.take(500);
}

async function getFilteredProductCandidates(
	ctx: QueryCtx,
	args: {
		category?: (typeof MOLTENI_CATEGORIES)[number];
		organizationId: string;
		zone?: (typeof ZONES)[number];
	},
) {
	if (args.zone && args.category) {
		const category = args.category;
		const zone = args.zone;
		return await ctx.db
			.query("products")
			.withIndex("by_organization_and_status_and_zone_and_category", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("status", "active")
					.eq("zone", zone)
					.eq("molteniCategory", category),
			)
			.order("desc")
			.take(PRODUCT_FILTER_READ_LIMIT);
	}
	if (args.zone) {
		const zone = args.zone;
		return await ctx.db
			.query("products")
			.withIndex("by_organization_and_status_and_zone", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("status", "active")
					.eq("zone", zone),
			)
			.order("desc")
			.take(PRODUCT_FILTER_READ_LIMIT);
	}
	if (args.category) {
		const category = args.category;
		return await ctx.db
			.query("products")
			.withIndex("by_organization_and_status_and_category", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("status", "active")
					.eq("molteniCategory", category),
			)
			.order("desc")
			.take(PRODUCT_FILTER_READ_LIMIT);
	}
	return await ctx.db
		.query("products")
		.withIndex("by_organization_and_status", (q) =>
			q.eq("organizationId", args.organizationId).eq("status", "active"),
		)
		.order("desc")
		.take(PRODUCT_FILTER_READ_LIMIT);
}

async function paginateActiveProducts(
	ctx: QueryCtx,
	args: {
		category?: (typeof MOLTENI_CATEGORIES)[number];
		paginationOpts: {
			numItems: number;
			cursor: string | null;
			endCursor?: string | null;
			id?: number;
			maximumRowsRead?: number;
			maximumBytesRead?: number;
		};
		organizationId: string;
		zone?: (typeof ZONES)[number];
	},
) {
	if (args.zone) {
		const zone = args.zone;
		return await ctx.db
			.query("products")
			.withIndex("by_organization_and_status_and_zone", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("status", "active")
					.eq("zone", zone),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	}
	if (args.category) {
		const category = args.category;
		return await ctx.db
			.query("products")
			.withIndex("by_organization_and_status_and_category", (q) =>
				q
					.eq("organizationId", args.organizationId)
					.eq("status", "active")
					.eq("molteniCategory", category),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	}
	return await ctx.db
		.query("products")
		.withIndex("by_organization_and_status", (q) =>
			q.eq("organizationId", args.organizationId).eq("status", "active"),
		)
		.order("desc")
		.paginate(args.paginationOpts);
}

async function getSavedCompositions(ctx: QueryCtx, productId: Id<"products">) {
	const compositions = await ctx.db
		.query("productCompositions")
		.withIndex("by_product", (q) => q.eq("productId", productId))
		.take(100);
	const entries = await Promise.all(
		compositions.map(async (composition) => {
			const items = await ctx.db
				.query("productCompositionItems")
				.withIndex("by_composition", (q) =>
					q.eq("compositionId", composition._id),
				)
				.take(200);
			const sortedItems = items.sort(
				(left, right) => left.position - right.position,
			);
			return {
				_id: composition._id,
				name: composition.name,
				notes: composition.notes ?? null,
				createdAt: composition.createdAt,
				updatedAt: composition.updatedAt,
				items: sortedItems.map((item) => ({
					_id: item._id,
					moduleProductId: item.moduleProductId,
					variantId: item.variantId,
					quantity: item.quantity,
					position: item.position,
					moduleName: item.moduleName,
					moduleKind: item.moduleKind ?? "component",
					variantLabel: item.variantLabel,
					priceHt: item.priceHt ?? null,
					ecoParticipationHt: item.ecoParticipationHt ?? null,
					ecoParticipationTtc: item.ecoParticipationTtc ?? null,
					weightKg: item.weightKg ?? null,
					widthCm: item.widthCm ?? null,
					textileMode: item.textileMode ?? null,
					ecomaisonCode11: item.ecomaisonCode11 ?? null,
				})),
				totalEcoHt: sumKnown(
					items.map((item) => (item.ecoParticipationHt ?? 0) * item.quantity),
				),
				totalEcoTtc: sumKnown(
					items.map((item) => (item.ecoParticipationTtc ?? 0) * item.quantity),
				),
			};
		}),
	);
	return entries.sort((left, right) => right.createdAt - left.createdAt);
}

async function getVariantsForProducts(
	ctx: QueryOrMutationCtx,
	products: Doc<"products">[],
) {
	const entries = await Promise.all(
		products.map(async (product) => {
			const variants = await ctx.db
				.query("productVariants")
				.withIndex("by_product", (q) => q.eq("productId", product._id))
				.take(50);
			return [product._id, variants] as const;
		}),
	);
	return new Map(entries);
}

async function getParentNames(
	ctx: QueryOrMutationCtx,
	products: Doc<"products">[],
	organizationId: string,
) {
	const parentIds = Array.from(
		new Set(products.map((product) => product.parentId).filter(Boolean)),
	) as Id<"products">[];
	const entries = await Promise.all(
		parentIds.map(async (parentId) => {
			const parent = await ctx.db.get(parentId);
			const parentName =
				parent?.organizationId === organizationId ? parent.name : null;
			return [parentId, parentName] as const;
		}),
	);
	return new Map(entries);
}

function toProductRow(
	product: Doc<"products">,
	variants: Doc<"productVariants">[],
) {
	const defaultVariant = variants[0] ?? null;
	const missingFields = getMissingFields(product, defaultVariant);
	return {
		...serializeProduct(product),
		type: product.parentId
			? "module"
			: product.isComposition
				? "composition"
				: "standalone",
		variantCount: variants.length,
		weightKg: defaultVariant?.weightKg ?? null,
		ecoParticipationHt: defaultVariant?.ecoParticipationHt ?? null,
		ecoParticipationTtc: defaultVariant?.ecoParticipationTtc ?? null,
		ecomaisonCode11:
			defaultVariant?.manualEcomaisonCode11 ??
			defaultVariant?.ecomaisonCode11 ??
			null,
		reference: defaultVariant?.reference ?? null,
		fabricReference: defaultVariant?.fabricReference ?? null,
		priceHt: defaultVariant?.priceHt ?? null,
		widthCm: defaultVariant?.widthCm ?? null,
		textileMode: defaultVariant?.textileMode ?? null,
		variants,
		missingFields,
		status: product.soldDate
			? "sold"
			: missingFields.length === 0 &&
					defaultVariant?.ecoParticipationHt !== undefined
				? "calculated"
				: "incomplete",
	};
}

function serializeProduct(product: Doc<"products">) {
	return {
		_id: product._id,
		name: product.name,
		molteniCategory: product.molteniCategory,
		ecomaisonFamily: product.ecomaisonFamily,
		materialTier: product.materialTier ?? null,
		zone: product.zone ?? null,
		hasRecyclingDisruptors: product.hasRecyclingDisruptors ?? null,
		sustainableCertified: product.sustainableCertified ?? null,
		evolutionaryDesign: product.evolutionaryDesign ?? null,
		isComposition: product.isComposition,
		moduleKind: product.moduleKind ?? (product.parentId ? "component" : null),
		parentId: product.parentId ?? null,
		notes: product.notes ?? null,
		status: product.status,
		soldDate: product.soldDate ?? null,
		tvaRate: product.tvaRate,
	};
}

function getMissingFields(
	product: Doc<"products">,
	variant: Doc<"productVariants"> | null,
) {
	const fields: Array<"weight" | "material" | "bareme"> = [];
	const needsWeight =
		product.ecomaisonFamily !== "Literie" &&
		!(
			product.ecomaisonFamily === "Décoration textile" &&
			variant?.textileMode === "piece"
		);
	if (
		!product.isComposition &&
		needsWeight &&
		variant?.weightKg === undefined
	) {
		fields.push("weight");
	}
	if (
		!product.isComposition &&
		product.ecomaisonFamily === "Literie" &&
		variant?.widthCm === undefined
	) {
		fields.push("weight");
	}
	if (
		!product.isComposition &&
		isMaterialRequired(product.ecomaisonFamily as EcomaisonFamily) &&
		!product.materialTier
	) {
		fields.push("material");
	}
	if (
		!product.isComposition &&
		(variant?.weightKg !== undefined || variant?.widthCm !== undefined) &&
		variant.ecoParticipationHt === undefined
	) {
		fields.push("bareme");
	}
	return fields;
}

function validateProductInput(args: {
	name: string;
	ecomaisonFamily: EcomaisonFamily;
	evolutionaryDesign?: boolean;
	isComposition?: boolean;
	materialTier?: MaterialTier;
	hasRecyclingDisruptors?: boolean;
	sustainableCertified?: boolean;
}) {
	if (!args.name.trim()) throw new Error("Product name is required");
	if (
		!args.isComposition &&
		isMaterialRequired(args.ecomaisonFamily) &&
		!args.materialTier
	) {
		throw new Error("Material is required for this Ecomaison family");
	}
	if (
		!args.isComposition &&
		args.materialTier &&
		!isMaterialAllowedWithDisruptors(
			args.materialTier,
			args.hasRecyclingDisruptors ?? false,
		)
	) {
		throw new Error(
			"This material tier is only valid for products without recycling disruptors",
		);
	}
	if (
		!args.isComposition &&
		args.hasRecyclingDisruptors &&
		(args.sustainableCertified || args.evolutionaryDesign)
	) {
		throw new Error(
			"Eco-modulations are only valid for products without recycling disruptors",
		);
	}
}

function getStoredMaterialTier(args: {
	ecomaisonFamily: EcomaisonFamily;
	isComposition?: boolean;
	materialTier?: MaterialTier;
}) {
	if (args.isComposition || args.ecomaisonFamily === "Siège avec rembourrage") {
		return undefined;
	}
	return args.materialTier;
}

function matchesSearch(
	row: ReturnType<typeof toProductRow>,
	search: string | undefined,
) {
	const normalized = search?.trim().toLowerCase();
	if (!normalized) return true;
	return (
		row.name.toLowerCase().includes(normalized) ||
		(row.reference?.toLowerCase().includes(normalized) ?? false)
	);
}

function matchesStatus(
	row: ReturnType<typeof toProductRow>,
	status: "all" | "calculated" | "incomplete" | "sold" | undefined,
) {
	if (!status || status === "all") return true;
	return row.status === status;
}

function normalizePage(value: number) {
	if (!Number.isFinite(value)) return 0;
	return Math.max(0, Math.floor(value));
}

function normalizePageSize(value: number) {
	if (!Number.isFinite(value)) return 50;
	return Math.min(MAX_PRODUCT_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function emptyProductPage(page: number, pageSize: number) {
	return {
		rows: [],
		page,
		pageSize,
		totalCount: 0,
		totalPages: 1,
		startIndex: 0,
		endIndex: 0,
		hasPreviousPage: false,
		hasNextPage: false,
	};
}

function normalizeOptional(value: string | undefined) {
	const normalized = value?.trim();
	return normalized ? normalized : undefined;
}

function normalizeVariantLabel(value: string | undefined) {
	return normalizeOptional(value) ?? "Version showroom";
}

function percent(value: number, total: number) {
	if (total === 0) return 0;
	return Math.round((value / total) * 100);
}

function sumKnown(values: Array<number | null | undefined>) {
	return roundMoney(
		values.reduce<number>((total, value) => total + (value ?? 0), 0),
	);
}

function getQuarterRange(year: number, quarter: "T1" | "T2" | "T3" | "T4") {
	const ranges = {
		T1: { start: `${year}-01-01`, end: `${year}-03-31` },
		T2: { start: `${year}-04-01`, end: `${year}-06-30` },
		T3: { start: `${year}-07-01`, end: `${year}-09-30` },
		T4: { start: `${year}-10-01`, end: `${year}-12-31` },
	};
	return ranges[quarter];
}

function emptyDashboard() {
	return {
		stats: {
			totalProducts: 0,
			calculated: 0,
			calculatedPercent: 0,
			missingWeight: 0,
			missingMaterial: 0,
		},
		byCategory: [],
		attention: [],
	};
}

function emptyDeclaration() {
	return {
		stats: { count: 0, weightKg: 0, ecoHt: 0, ecoTtc: 0 },
		byFamily: [],
		rows: [],
	};
}

type QueryOrMutationCtx = QueryCtx | MutationCtx;
