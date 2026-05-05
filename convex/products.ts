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
	getDefaultFamily,
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
import { authComponent } from "./auth";

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
const BASE_MODULE_NAME = "Base / Structure";

type SeedProduct = {
	category: (typeof MOLTENI_CATEGORIES)[number];
	isComposition?: boolean;
	moduleKind?: "base" | "component";
	materialTier?: MaterialTier;
	name: string;
	notes: string;
	priceHt?: number;
	reference: string;
	weightKg?: number;
	zone: (typeof ZONES)[number];
};

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

const seedProducts: SeedProduct[] = [
	{
		name: "GLOVE Fauteuil",
		category: "Fauteuil",
		zone: "A",
		reference: "GLOVE-LOW",
		weightKg: 32,
		priceHt: 2850,
		notes: "Exemple rembourré avec poids dans le barème partiel.",
	},
	{
		name: "CHELSEA Chaise",
		category: "Chaise",
		zone: "B",
		reference: "CHELSEA-CHAIR",
		weightKg: 12,
		notes: "Chaise non rembourrée par défaut, matière à confirmer.",
	},
	{
		name: "ARC Table basse",
		category: "Table basse",
		zone: "C",
		reference: "ARC-TB",
		materialTier: "tous_materiaux",
		weightKg: 42,
		priceHt: 4100,
		notes: "Table mixte initialisée au barème pénalisant.",
	},
	{
		name: "DRESSING 505",
		category: "Dressing",
		zone: "F",
		reference: "505-DRESSING",
		isComposition: true,
		notes: "Composition exemple. Ajouter les modules séparément.",
	},
	{
		name: "PAUL Canapé composition",
		category: "Canapé",
		zone: "G",
		reference: "PAUL-COMP",
		isComposition: true,
		notes: "Somme des modules, pas lookup sur poids total.",
	},
];

/**
 * Idempotently seeds the Lyon showroom and a small product sample.
 */
export const ensureSeedData = mutation({
	args: {},
	handler: async (ctx) => {
		const userId = await requireUserId(ctx);
		const now = Date.now();
		const showroom = await getOrCreateShowroom(ctx, now);
		await seedExampleProducts(ctx, showroom._id, userId, now);
		return { showroomId: showroom._id };
	},
});

/**
 * Returns dashboard inventory health for the authenticated showroom workspace.
 */
export const getDashboard = query({
	args: {},
	handler: async (ctx) => {
		await requireUserId(ctx);
		const showroom = await getShowroom(ctx);
		if (!showroom) return emptyDashboard();

		const products = await getActiveProducts(ctx, showroom._id);
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
		type: v.optional(
			v.union(
				v.literal("all"),
				v.literal("standalone"),
				v.literal("composition"),
				v.literal("module"),
			),
		),
		status: v.optional(
			v.union(
				v.literal("all"),
				v.literal("calculated"),
				v.literal("incomplete"),
				v.literal("sold"),
			),
		),
	},
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		const showroom = await getShowroom(ctx);
		if (!showroom) return [];

		const products = await getActiveProducts(ctx, showroom._id);
		const variants = await getVariantsForProducts(ctx, products);
		const parentNames = await getParentNames(ctx, products);
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
 * Returns a live, cursor-paginated product page for the inventory table.
 */
export const listProductsPaginated = query({
	args: {
		paginationOpts: paginationOptsValidator,
		search: v.optional(v.string()),
		zone: v.optional(v.union(v.literal("all"), zoneValidator)),
		category: v.optional(v.union(v.literal("all"), categoryValidator)),
		type: v.optional(
			v.union(
				v.literal("all"),
				v.literal("standalone"),
				v.literal("composition"),
				v.literal("module"),
			),
		),
		status: v.optional(
			v.union(
				v.literal("all"),
				v.literal("calculated"),
				v.literal("incomplete"),
				v.literal("sold"),
			),
		),
	},
	handler: async (ctx, args) => {
		await requireUserId(ctx);
		const showroom = await getShowroom(ctx);
		if (!showroom) {
			return { page: [], isDone: true, continueCursor: "" };
		}

		const zone = args.zone === "all" ? undefined : args.zone;
		const category = args.category === "all" ? undefined : args.category;
		const productsPage = await paginateActiveProducts(ctx, {
			category,
			paginationOpts: args.paginationOpts,
			showroomId: showroom._id,
			zone,
		});
		const variants = await getVariantsForProducts(ctx, productsPage.page);
		const parentNames = await getParentNames(ctx, productsPage.page);
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
		await requireUserId(ctx);
		const product = await ctx.db.get(args.productId);
		if (!product || product.status === "deleted") return null;

		const variants = await ctx.db
			.query("productVariants")
			.withIndex("by_product", (q) => q.eq("productId", product._id))
			.take(50);
		const children = await ctx.db
			.query("products")
			.withIndex("by_parent", (q) => q.eq("parentId", product._id))
			.take(100);
		const activeChildren = children.filter(
			(child) => child.status !== "deleted",
		);
		const childVariants = await getVariantsForProducts(ctx, activeChildren);
		const childRows = activeChildren.map((child) =>
			toProductRow(child, childVariants.get(child._id) ?? []),
		);
		const baseModule =
			childRows.find((child) => child.moduleKind === "base") ?? null;
		const modules = childRows.filter((child) => child.moduleKind !== "base");
		const parent = product.parentId ? await ctx.db.get(product.parentId) : null;
		const totalRows = baseModule ? [baseModule, ...modules] : modules;

		return {
			product: serializeProduct(product),
			parent: parent ? serializeProduct(parent) : null,
			variants,
			baseModule,
			modules,
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
		await requireUserId(ctx);
		const showroom = await getShowroom(ctx);
		if (!showroom) return emptyDeclaration();

		const products = await getActiveProducts(ctx, showroom._id);
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
		const userId = await requireUserId(ctx);
		validateProductInput(args);
		const showroom = await getOrCreateShowroom(ctx, Date.now());
		const now = Date.now();
		const isComposition = args.isComposition && !args.parentId;
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
			showroomId: showroom._id,
			notes: normalizeOptional(args.notes),
			status: "active",
			tvaRate: args.tvaRate,
			createdByUserId: userId,
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
				source: args,
				showroomId: showroom._id,
				userId,
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
		await requireUserId(ctx);
		validateProductInput(args);
		const product = await ctx.db.get(args.productId);
		if (!product || product.status === "deleted") {
			throw new Error("Product not found");
		}

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
		await requireUserId(ctx);
		const product = await ctx.db.get(args.productId);
		if (!product || product.status === "deleted") {
			throw new Error("Product not found");
		}
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
		await requireUserId(ctx);
		const variant = await ctx.db.get(args.variantId);
		if (!variant) throw new Error("Variant not found");
		const product = await ctx.db.get(variant.productId);
		if (!product || product.status === "deleted") {
			throw new Error("Product not found");
		}
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
		await requireUserId(ctx);
		const variant = await ctx.db.get(args.variantId);
		if (!variant) return null;
		const product = await ctx.db.get(variant.productId);
		if (!product || product.status === "deleted") {
			throw new Error("Product not found");
		}
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
		await requireUserId(ctx);
		const normalized = args.code?.trim();
		if (normalized && !/^\d{11}$/.test(normalized)) {
			throw new Error("Ecomaison code must contain exactly 11 digits");
		}
		await ctx.db.patch(args.variantId, {
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
		await requireUserId(ctx);
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
		await requireUserId(ctx);
		await ctx.db.patch(args.productId, {
			soldDate: args.soldDate ?? undefined,
			updatedAt: Date.now(),
		});
		return null;
	},
});

async function requireUserId(ctx: QueryOrMutationCtx) {
	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser?.userId) throw new Error("Not authenticated");
	return authUser.userId as unknown as Id<"users">;
}

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

async function seedExampleProducts(
	ctx: MutationCtx,
	showroomId: Id<"showrooms">,
	userId: Id<"users">,
	now: number,
) {
	const existing = await ctx.db
		.query("products")
		.withIndex("by_showroom", (q) => q.eq("showroomId", showroomId))
		.take(1);
	if (existing.length > 0) return;

	for (const seed of seedProducts) {
		const category = seed.category;
		const family = getDefaultFamily(category);
		const productId = await ctx.db.insert("products", {
			name: seed.name,
			molteniCategory: category,
			ecomaisonFamily: family,
			materialTier:
				family === "Siège avec rembourrage" ? undefined : seed.materialTier,
			zone: seed.zone,
			hasRecyclingDisruptors: false,
			sustainableCertified: false,
			evolutionaryDesign: false,
			isComposition: seed.isComposition ?? false,
			showroomId,
			notes: seed.notes,
			status: "active",
			tvaRate: 0.2,
			createdByUserId: userId,
			createdAt: now,
			updatedAt: now,
		});
		const product = await ctx.db.get(productId);
		const calculation = await calculateVariant(ctx, {
			product,
			weightKg: seed.weightKg,
			widthCm: undefined,
			textileMode: undefined,
			tvaRate: 0.2,
		});
		await ctx.db.insert("productVariants", {
			productId,
			variantLabel: "Version showroom",
			reference: seed.reference,
			priceHt: seed.priceHt,
			weightKg: seed.weightKg,
			ecoParticipationHt: calculation?.ecoHt,
			ecoParticipationTtc: calculation?.ecoTtc,
			ecomaisonCode11: calculation?.officialProductCode,
			isEcomaisonCodeManual: false,
			createdAt: now,
			updatedAt: now,
		});
	}
}

async function createBaseModule(
	ctx: MutationCtx,
	args: {
		now: number;
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
	showroomId: Id<"showrooms">,
) {
	return await ctx.db
		.query("products")
		.withIndex("by_showroom_and_status", (q) =>
			q.eq("showroomId", showroomId).eq("status", "active"),
		)
		.take(500);
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
		showroomId: Id<"showrooms">;
		zone?: (typeof ZONES)[number];
	},
) {
	if (args.zone) {
		const zone = args.zone;
		return await ctx.db
			.query("products")
			.withIndex("by_showroom_and_status_and_zone", (q) =>
				q
					.eq("showroomId", args.showroomId)
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
			.withIndex("by_showroom_and_status_and_category", (q) =>
				q
					.eq("showroomId", args.showroomId)
					.eq("status", "active")
					.eq("molteniCategory", category),
			)
			.order("desc")
			.paginate(args.paginationOpts);
	}
	return await ctx.db
		.query("products")
		.withIndex("by_showroom_and_status", (q) =>
			q.eq("showroomId", args.showroomId).eq("status", "active"),
		)
		.order("desc")
		.paginate(args.paginationOpts);
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
) {
	const parentIds = Array.from(
		new Set(products.map((product) => product.parentId).filter(Boolean)),
	) as Id<"products">[];
	const entries = await Promise.all(
		parentIds.map(async (parentId) => {
			const parent = await ctx.db.get(parentId);
			return [parentId, parent?.name ?? null] as const;
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
