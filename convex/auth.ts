import { apiKey } from "@better-auth/api-key";
import {
	type AuthFunctions,
	type GenericCtx,
	createClient,
} from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { type BetterAuthOptions, betterAuth } from "better-auth/minimal";
import { mcp } from "better-auth/plugins";
import { organization } from "better-auth/plugins/organization";
import { components, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
import { query } from "./_generated/server";
import authConfig from "./auth.config";
import betterAuthSchema from "./betterAuth/schema";

const siteUrl = process.env.SITE_URL ?? "http://localhost:8888";
const trustedOrigins = (() => {
	const origins = [siteUrl];

	try {
		const { hostname } = new URL(siteUrl);
		if (hostname === "localhost" || hostname === "127.0.0.1") {
			origins.push("http://localhost:*", "http://127.0.0.1:*");
		}
	} catch {}

	return Array.from(new Set(origins));
})();

// biome-ignore lint/suspicious/noExplicitAny: AuthFunctions type resolved after npx convex dev
const authFunctions: AuthFunctions = internal.auth as any;

// The component client provides methods for integrating Convex with Better Auth,
// plus helper methods for getting authenticated users.
// biome-ignore lint/suspicious/noExplicitAny: component types resolved after npx convex dev
const betterAuthRef = (components as any).betterAuth;
export const authComponent = createClient<DataModel, typeof betterAuthSchema>(
	betterAuthRef,
	{
		authFunctions,
		local: {
			schema: betterAuthSchema,
		},
		triggers: {
			user: {
				onCreate: async (ctx, authUser) => {
					const userId = await ctx.db.insert("users", {
						email: authUser.email,
						name: authUser.name,
					});
					await authComponent.setUserId(
						ctx,
						authUser._id,
						userId as unknown as string,
					);
				},
				onUpdate: async (ctx, newUser, oldUser) => {
					if (
						oldUser.email === newUser.email &&
						oldUser.name === newUser.name
					) {
						return;
					}
					await ctx.db.patch(newUser.userId as unknown as Id<"users">, {
						email: newUser.email,
						name: newUser.name,
					});
				},
				onDelete: async (ctx, authUser) => {
					if (!authUser.userId) return;
					const user = await ctx.db.get(
						authUser.userId as unknown as Id<"users">,
					);
					if (user) {
						await ctx.db.delete(user._id);
					}
				},
			},
		},
	},
);

// Trigger API exports — required by the component for lifecycle hooks
export const { onCreate, onUpdate, onDelete } = authComponent.triggersApi();
// Client API exports — required by the component for auth queries
export const { getAuthUser } = authComponent.clientApi();

// Better Auth options factory (used by adapter and schema generation)
export const createAuthOptions = (ctx: GenericCtx<DataModel>) =>
	({
		baseURL: siteUrl,
		trustedOrigins,
		database: authComponent.adapter(ctx),
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: false,
		},
		plugins: [
			convex({ authConfig }),
			organization({
				allowUserToCreateOrganization: true,
			}),
			apiKey({
				defaultPrefix: "bd_",
				// API keys passed via the x-api-key header (default) create a
				// mock session so that /get-session returns user + session for
				// REST and MCP callers using the same credential type.
				apiKeyHeaders: "x-api-key",
				enableSessionForAPIKeys: true,
				rateLimit: {
					enabled: false,
				},
			}),
			mcp({
				loginPage: "/mcp/login",
			}),
		],
		hooks: {
			before: createAuthMiddleware(async (ctx) => {
				if (ctx.path !== "/sign-up/email") return;
				const superAdminPassword = process.env.SUPER_ADMIN_SIGNUP_PASSWORD;
				if (!superAdminPassword) return;
				const provided = ctx.headers?.get("x-super-admin-password");
				if (provided !== superAdminPassword) {
					throw new APIError("FORBIDDEN", {
						message: "Invalid super admin password",
					});
				}
			}),
		},
	}) satisfies BetterAuthOptions;

// Better Auth instance factory (used by HTTP routes and server-side auth calls)
export const createAuth = (ctx: GenericCtx<DataModel>) =>
	betterAuth(createAuthOptions(ctx));

// Returns the authenticated app user, or null if not authenticated.
export const getCurrentUser = query({
	args: {},
	handler: async (ctx) => {
		return await authComponent.safeGetAuthUser(ctx);
	},
});
