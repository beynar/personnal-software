// Convex file storage pattern — mutations and queries for file upload/list/delete.
// Uses Convex's built-in storage system (_storage table) with a custom files table
// to track metadata (name, size, type, upload date, owner).

import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// Generate a short-lived upload URL for the client to upload a file directly to Convex storage.
export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) throw new Error("Unauthenticated");
		return await ctx.storage.generateUploadUrl();
	},
});

// Save file metadata after a successful upload. Call this after uploading to the URL
// returned by generateUploadUrl, passing the storageId from the upload response.
export const saveFile = mutation({
	args: {
		storageId: v.id("_storage"),
		name: v.string(),
		size: v.number(),
		type: v.string(),
	},
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) throw new Error("Unauthenticated");
		return await ctx.db.insert("files", {
			storageId: args.storageId,
			name: args.name,
			size: args.size,
			type: args.type,
			uploadedAt: Date.now(),
			userId: authUser.userId as unknown as Id<"users">,
		});
	},
});

// Delete a file and its storage blob. Only the file owner can delete.
export const deleteFile = mutation({
	args: { fileId: v.id("files") },
	handler: async (ctx, args) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) throw new Error("Unauthenticated");
		const userId = authUser.userId as unknown as Id<"users">;
		const file = await ctx.db.get(args.fileId);
		if (!file) throw new Error("File not found");
		if (file.userId !== userId) throw new Error("Unauthorized");
		await ctx.storage.delete(file.storageId);
		await ctx.db.delete(args.fileId);
	},
});

// List all files for the current user, newest first.
// Returns file metadata plus a download URL for each file.
export const listFiles = query({
	args: {},
	handler: async (ctx) => {
		const authUser = await authComponent.safeGetAuthUser(ctx);
		if (!authUser?.userId) return [];
		const userId = authUser.userId as unknown as Id<"users">;
		const files = await ctx.db
			.query("files")
			.withIndex("by_user", (q) => q.eq("userId", userId))
			.order("desc")
			.collect();
		return await Promise.all(
			files.map(async (file) => ({
				...file,
				url: await ctx.storage.getUrl(file.storageId),
			})),
		);
	},
});
