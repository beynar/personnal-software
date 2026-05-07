import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import {
	type BetterAuthDocument,
	findBetterAuthMany,
	findBetterAuthOne,
	readBetterAuthString,
} from "./auth";

const LYON_ORGANIZATION_NAME = "Lyon";
const LYON_ORGANIZATION_SLUG = "lyon";
const ORGANIZATION_LOOKUP_LIMIT = 200;
const PRODUCT_GRAPH_EXPORT_LIMIT = 5000;
const PRODUCT_MIGRATION_CONFIRMATION = "assign-products-to-lyon";

type QueryOrMutationCtx = QueryCtx | MutationCtx;

/**
 * Read-only guardrail before assigning legacy products to Better Auth orgs.
 */
export const previewOrganizationProductMigration = query({
	args: {
		organizationId: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await requireMigrationUser(ctx);
		const targetOrganization = await resolveTargetOrganization(
			ctx,
			args.organizationId,
		);
		const products = await getProductSnapshot(ctx);

		return {
			targetOrganization,
			productCount: products.length,
			productsMissingOrganizationId: products.filter(
				(product) => !product.organizationId,
			).length,
			existingOrganizationAssignments:
				summarizeOrganizationAssignments(products),
			creators: summarizeProductCreators(products),
			sampleProductNames: products.slice(0, 20).map((product) => product.name),
			missingOrganizationSampleNames: products
				.filter((product) => !product.organizationId)
				.slice(0, 20)
				.map((product) => product.name),
		};
	},
});

/**
 * Lists Better Auth organizations so production backfill can use an explicit ID
 * when the historical "Lyon" assumption does not match production.
 */
export const listOrganizationMigrationCandidates = query({
	args: {},
	handler: async (ctx) => {
		await requireMigrationUser(ctx);
		const organizations = await findBetterAuthMany(ctx, {
			limit: ORGANIZATION_LOOKUP_LIMIT,
			model: "organization",
		});
		return organizations.map((organization) =>
			toOrganizationSummary(organization),
		);
	},
});

/**
 * Returns the product graph as JSON-serializable data for a local backup file.
 */
export const exportProductGraphBackup = query({
	args: {},
	handler: async (ctx) => {
		await requireMigrationUser(ctx);
		const [products, productVariants, productCompositions, compositionItems] =
			await Promise.all([
				getLimitedTable(ctx, "products"),
				getLimitedTable(ctx, "productVariants"),
				getLimitedTable(ctx, "productCompositions"),
				getLimitedTable(ctx, "productCompositionItems"),
			]);

		return {
			exportedAt: Date.now(),
			counts: {
				products: products.length,
				productVariants: productVariants.length,
				productCompositions: productCompositions.length,
				productCompositionItems: compositionItems.length,
			},
			products,
			productVariants,
			productCompositions,
			productCompositionItems: compositionItems,
		};
	},
});

/**
 * Non-destructive backfill: only products without organizationId are patched.
 */
export const backfillProductsToOrganization = mutation({
	args: {
		confirmation: v.string(),
		expectedProductCount: v.number(),
		organizationId: v.string(),
	},
	handler: async (ctx, args) => {
		await requireMigrationUser(ctx);
		if (args.confirmation !== PRODUCT_MIGRATION_CONFIRMATION) {
			throw new Error("Invalid migration confirmation string");
		}

		const targetOrganization = await getOrganizationById(
			ctx,
			args.organizationId,
		);
		if (!targetOrganization) {
			throw new Error("Target organization not found");
		}

		const products = await getProductSnapshot(ctx);
		const productsMissingOrganization = products.filter(
			(product) => !product.organizationId,
		);
		if (productsMissingOrganization.length !== args.expectedProductCount) {
			throw new Error(
				`Expected ${args.expectedProductCount} products to backfill, found ${productsMissingOrganization.length}`,
			);
		}

		const now = Date.now();
		await Promise.all(
			productsMissingOrganization.map((product) =>
				ctx.db.patch(product._id, {
					organizationId: args.organizationId,
					updatedAt: now,
				}),
			),
		);

		return {
			targetOrganization: toOrganizationSummary(targetOrganization),
			patchedProductCount: productsMissingOrganization.length,
		};
	},
});

async function requireMigrationUser(ctx: QueryOrMutationCtx) {
	const identity = await ctx.auth.getUserIdentity();
	if (!identity) throw new Error("Not authenticated");
	return identity;
}

async function resolveTargetOrganization(
	ctx: QueryOrMutationCtx,
	organizationId: string | undefined,
) {
	if (organizationId) {
		const organization = await getOrganizationById(ctx, organizationId);
		if (!organization) throw new Error("Target organization not found");
		return toOrganizationSummary(organization);
	}

	const organizations = await findBetterAuthMany(ctx, {
		limit: ORGANIZATION_LOOKUP_LIMIT,
		model: "organization",
	});
	const matches = organizations.filter((organization) => {
		return (
			readBetterAuthString(organization, "slug") === LYON_ORGANIZATION_SLUG ||
			readBetterAuthString(organization, "name") === LYON_ORGANIZATION_NAME
		);
	});
	if (matches.length === 0) {
		throw new Error("No Lyon organization found");
	}
	if (matches.length > 1) {
		throw new Error(
			"Ambiguous Lyon organization; pass organizationId explicitly",
		);
	}

	return toOrganizationSummary(matches[0]);
}

async function getOrganizationById(
	ctx: QueryOrMutationCtx,
	organizationId: string,
) {
	return await findBetterAuthOne(ctx, {
		model: "organization",
		where: [{ field: "_id", value: organizationId }],
	});
}

async function getProductSnapshot(ctx: QueryOrMutationCtx) {
	return await getLimitedTable(ctx, "products");
}

async function getLimitedTable<TableName extends ProductGraphTable>(
	ctx: QueryOrMutationCtx,
	tableName: TableName,
) {
	const rows = await ctx.db
		.query(tableName)
		.take(PRODUCT_GRAPH_EXPORT_LIMIT + 1);
	if (rows.length > PRODUCT_GRAPH_EXPORT_LIMIT) {
		throw new Error(
			`Product graph export limit exceeded for ${tableName}; add batched migration tooling before continuing`,
		);
	}
	return rows;
}

function summarizeOrganizationAssignments(products: Doc<"products">[]) {
	const assignments = new Map<
		string,
		{ count: number; sampleNames: string[] }
	>();
	for (const product of products) {
		const organizationId = product.organizationId ?? "missing";
		const summary = assignments.get(organizationId) ?? {
			count: 0,
			sampleNames: [],
		};
		summary.count += 1;
		if (summary.sampleNames.length < 10) {
			summary.sampleNames.push(product.name);
		}
		assignments.set(organizationId, summary);
	}
	return Array.from(assignments.entries()).map(([organizationId, summary]) => ({
		organizationId,
		...summary,
	}));
}

function summarizeProductCreators(products: Doc<"products">[]) {
	const creators = new Map<string, number>();
	for (const product of products) {
		const creatorId = product.createdByUserId ?? "missing";
		creators.set(creatorId, (creators.get(creatorId) ?? 0) + 1);
	}
	return Array.from(creators.entries()).map(([createdByUserId, count]) => ({
		count,
		createdByUserId,
	}));
}

function toOrganizationSummary(organization: BetterAuthDocument) {
	const id = readBetterAuthString(organization, "_id");
	if (!id) throw new Error("Organization is missing an id");
	return {
		id,
		name: readBetterAuthString(organization, "name"),
		slug: readBetterAuthString(organization, "slug"),
	};
}

type ProductGraphTable =
	| "products"
	| "productVariants"
	| "productCompositions"
	| "productCompositionItems";
