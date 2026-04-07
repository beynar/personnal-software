import type { GenericQueryCtx } from "convex/server";
import { queryGeneric } from "convex/server";
import { auth } from "./auth";

export const viewer = queryGeneric({
	args: {},
	handler: async (ctx: GenericQueryCtx<Record<string, never>>) => {
		const userId = await auth.getUserId(ctx);
		if (!userId) {
			return null;
		}
		return await ctx.db.get(userId);
	},
});
