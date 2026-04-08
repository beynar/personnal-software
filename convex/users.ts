import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

/**
 * Returns the authenticated user document for dashboard surfaces.
 */
export const viewer = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) return null;

		const user = await ctx.db.get(authUser.userId as unknown as Id<"users">);
		if (!user) return null;

		const image = user.imageStorageId
			? await ctx.storage.getUrl(user.imageStorageId)
			: user.image;

		return {
			...user,
			email: user.email ?? authUser.email,
			image,
			name: user.name ?? authUser.name,
		};
	},
});

/**
 * Updates the current user's profile fields with basic normalization and
 * username uniqueness enforcement.
 */
export const updateProfile = mutation({
	args: {
		name: v.string(),
		username: v.string(),
		bio: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) throw new Error("Not authenticated");

		const userId = authUser.userId as unknown as Id<"users">;
		const name = normalizeOptionalValue(args.name, 80);
		const username = normalizeUsername(args.username);
		const bio = normalizeOptionalValue(args.bio, 280);

		if (username) {
			const existingUser = await ctx.db
				.query("users")
				.withIndex("by_username", (query) => query.eq("username", username))
				.unique();

			if (existingUser && existingUser._id !== userId) {
				throw new Error("Username is already taken");
			}
		}

		await ctx.db.patch(userId, { bio, name, username });
		return null;
	},
});

/**
 * Backfills app-side profile fields from the Better Auth user record for
 * accounts created before profile sync was wired correctly.
 */
export const syncViewerProfile = mutation({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) throw new Error("Not authenticated");

		const userId = authUser.userId as unknown as Id<"users">;
		const user = await ctx.db.get(userId);
		if (!user) throw new Error("User not found");

		const patch: { email?: string; name?: string } = {};
		if (!user.email && authUser.email) {
			patch.email = authUser.email;
		}
		if (!user.name && authUser.name) {
			patch.name = authUser.name;
		}
		if (Object.keys(patch).length === 0) {
			return null;
		}

		await ctx.db.patch(userId, patch);
		return null;
	},
});

/**
 * Stores or clears the current user's uploaded profile image reference.
 */
export const updateProfileImage = mutation({
	args: {
		storageId: v.union(v.id("_storage"), v.null()),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) throw new Error("Not authenticated");

		const userId = authUser.userId as unknown as Id<"users">;
		const user = await ctx.db.get(userId);
		if (!user) throw new Error("User not found");

		if (user.imageStorageId && user.imageStorageId !== args.storageId) {
			await ctx.storage.delete(user.imageStorageId);
		}

		await ctx.db.patch(userId, {
			imageStorageId: args.storageId ?? undefined,
		});
		return null;
	},
});

function normalizeOptionalValue(value: string, maxLength: number) {
	const normalizedValue = value.trim().slice(0, maxLength);
	return normalizedValue ? normalizedValue : undefined;
}

function normalizeUsername(value: string) {
	const normalizedValue = value.trim().toLowerCase().replaceAll(/\s+/g, "-");
	if (!normalizedValue) return undefined;

	if (!/^[a-z0-9_-]{3,32}$/.test(normalizedValue)) {
		throw new Error(
			"Username must be 3-32 characters and use letters, numbers, hyphens, or underscores",
		);
	}
	return normalizedValue;
}
