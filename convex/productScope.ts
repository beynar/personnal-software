import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { authComponent, requireActiveOrganizationId } from "./auth";

type QueryOrMutationCtx = QueryCtx | MutationCtx;

export type ProductScope = {
	organizationId: string;
	userId: Id<"users">;
};

export async function requireProductScope(
	ctx: QueryOrMutationCtx,
): Promise<ProductScope> {
	const authUser = await authComponent.safeGetAuthUser(ctx);
	if (!authUser?.userId) throw new Error("Not authenticated");

	return {
		organizationId: await requireActiveOrganizationId(ctx),
		userId: authUser.userId as unknown as Id<"users">,
	};
}

export async function getProductInScope(
	ctx: QueryOrMutationCtx,
	productId: Id<"products">,
	organizationId: string,
) {
	const product = await ctx.db.get(productId);
	if (!isAccessibleProduct(product, organizationId)) return null;
	return product;
}

export async function requireProductInScope(
	ctx: QueryOrMutationCtx,
	productId: Id<"products">,
	organizationId: string,
) {
	const product = await getProductInScope(ctx, productId, organizationId);
	if (!product) throw new Error("Product not found");
	return product;
}

export async function requireVariantInScope(
	ctx: QueryOrMutationCtx,
	variantId: Id<"productVariants">,
	organizationId: string,
) {
	const variant = await ctx.db.get(variantId);
	if (!variant) throw new Error("Variant not found");

	const product = await requireProductInScope(
		ctx,
		variant.productId,
		organizationId,
	);
	return { product, variant };
}

export async function getCompositionInScope(
	ctx: QueryOrMutationCtx,
	compositionId: Id<"productCompositions">,
	organizationId: string,
) {
	const composition = await ctx.db.get(compositionId);
	if (!composition) return null;

	const product = await getProductInScope(
		ctx,
		composition.productId,
		organizationId,
	);
	if (!product) return null;
	return { composition, product };
}

function isAccessibleProduct(
	product: Doc<"products"> | null,
	organizationId: string,
) {
	return (
		Boolean(product) &&
		product?.status !== "deleted" &&
		product?.organizationId === organizationId
	);
}
