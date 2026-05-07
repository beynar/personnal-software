import { ORPCError, implement } from "@orpc/server";

import { fetchAuthMutation, fetchAuthQuery } from "~/lib/auth-server";
import type { ApiContext } from "~/lib/orpc/context";
import { apiContract } from "~/lib/orpc/contract";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const orpc = implement(apiContract).$context<ApiContext>();

function requireAuth(context: ApiContext) {
	if (!context.auth) {
		throw new ORPCError("UNAUTHORIZED", {
			message:
				"Missing or invalid API credentials. Use a browser session, Authorization: Bearer <api-key>, x-api-key, or MCP session auth.",
		});
	}
}

/**
 * Concrete procedure implementations behind the canonical oRPC contract.
 * Business data should still come from Convex or other dedicated backends.
 */
export const apiRouter = {
	examples: {
		workflow: orpc.examples.workflow
			.use(({ context, next }) => {
				requireAuth(context);

				return next({
					context,
				});
			})
			.handler(async ({ input }) => {
				const { params, query, body } = input;

				return {
					success: true,
					received: {
						exampleId: params.exampleId,
						query: {
							q: query.q,
							limit: query.limit,
							dryRun: query.dryRun,
							channel: query.channel,
						},
						body: {
							message: body.message,
							priority: body.priority,
						},
					},
					preview: [
						`${params.exampleId}:${query.q}:1`,
						`${params.exampleId}:${query.q}:2`,
						`${params.exampleId}:${query.q}:${query.limit}`,
					],
					message: `Prepared ${query.channel} workflow for ${params.exampleId}${query.dryRun ? " (dry run)" : ""}.`,
				};
			}),
	},
	molteni: {
		dashboard: orpc.molteni.dashboard
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async () => {
				return await fetchAuthQuery(api.products.getDashboard);
			}),
		products: orpc.molteni.products
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				return await fetchAuthQuery(api.products.listProducts, input.query);
			}),
		createProduct: orpc.molteni.createProduct
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				const productId = await fetchAuthMutation(api.products.createProduct, {
					...input.body,
					parentId: input.body.parentId as Id<"products"> | undefined,
				});
				return { productId };
			}),
		updateProduct: orpc.molteni.updateProduct
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				await fetchAuthMutation(api.products.updateProduct, {
					...input.body,
					productId: input.params.productId as Id<"products">,
				});
				return { ok: true };
			}),
		product: orpc.molteni.product
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				return await fetchAuthQuery(api.products.getProduct, {
					productId: input.params.productId as Id<"products">,
				});
			}),
		addVariant: orpc.molteni.addVariant
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				const variantId = await fetchAuthMutation(api.products.addVariant, {
					...input.body,
					productId: input.params.productId as Id<"products">,
				});
				return { variantId };
			}),
		setProductSoldDate: orpc.molteni.setProductSoldDate
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				await fetchAuthMutation(api.products.setSoldDate, {
					productId: input.params.productId as Id<"products">,
					soldDate: input.body.soldDate,
				});
				return { ok: true };
			}),
		deleteProduct: orpc.molteni.deleteProduct
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				await fetchAuthMutation(api.products.softDeleteProduct, {
					productId: input.params.productId as Id<"products">,
				});
				return { ok: true };
			}),
		setVariantEcomaisonCode: orpc.molteni.setVariantEcomaisonCode
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				await fetchAuthMutation(api.products.setManualEcomaisonCode, {
					variantId: input.params.variantId as Id<"productVariants">,
					code: input.body.code,
				});
				return { ok: true };
			}),
		declaration: orpc.molteni.declaration
			.use(({ context, next }) => {
				requireAuth(context);
				return next({ context });
			})
			.handler(async ({ input }) => {
				return await fetchAuthQuery(api.products.getDeclaration, input.query);
			}),
	},
} as const;
