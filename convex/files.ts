// Convex file storage pattern — mutations and queries for file upload/list/delete.
// Uses Convex's built-in storage system (_storage table) with a custom files table
// to track metadata (name, size, type, upload date, owner).
//
// Note: We use casts because we reference tables via `queryGeneric`/`mutationGeneric`
// without Convex's generated types (`_generated/server`). The runtime behavior is correct;
// only the TypeScript layer lacks the schema-specific types.

import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { auth } from "./auth";

type Ctx = GenericQueryCtx<Record<string, never>>;
type MutCtx = GenericMutationCtx<Record<string, never>>;

// biome-ignore lint/suspicious/noExplicitAny: Convex generic ctx methods lose type info without _generated types
type AnyFn = (...args: any[]) => any;

// Generate a short-lived upload URL for the client to upload a file directly to Convex storage.
export const generateUploadUrl = mutationGeneric({
	args: {},
	handler: async (ctx: MutCtx) => {
		const userId = await auth.getUserId(ctx);
		if (!userId) throw new Error("Unauthenticated");
		return await ctx.storage.generateUploadUrl();
	},
});

// Save file metadata after a successful upload. Call this after uploading to the URL
// returned by generateUploadUrl, passing the storageId from the upload response.
export const saveFile = mutationGeneric({
	args: {
		storageId: v.id("_storage"),
		name: v.string(),
		size: v.number(),
		type: v.string(),
	},
	handler: async (
		ctx: MutCtx,
		args: { storageId: string; name: string; size: number; type: string },
	) => {
		const userId = await auth.getUserId(ctx);
		if (!userId) throw new Error("Unauthenticated");
		return await (ctx.db.insert as AnyFn)("files", {
			storageId: args.storageId,
			name: args.name,
			size: args.size,
			type: args.type,
			uploadedAt: Date.now(),
			userId,
		});
	},
});

// Delete a file and its storage blob. Only the file owner can delete.
export const deleteFile = mutationGeneric({
	args: { fileId: v.id("files") },
	handler: async (ctx: MutCtx, args: { fileId: string }) => {
		const userId = await auth.getUserId(ctx);
		if (!userId) throw new Error("Unauthenticated");
		const file = (await (ctx.db.get as AnyFn)(args.fileId)) as {
			userId: string;
			storageId: string;
		} | null;
		if (!file) throw new Error("File not found");
		if (file.userId !== userId) throw new Error("Unauthorized");
		// Delete the storage blob first, then the metadata record
		await ctx.storage.delete(file.storageId as never);
		await (ctx.db.delete as AnyFn)(args.fileId);
	},
});

// List all files for the current user, newest first.
// Returns file metadata plus a download URL for each file.
export const listFiles = queryGeneric({
	args: {},
	handler: async (ctx: Ctx) => {
		const userId = await auth.getUserId(ctx);
		if (!userId) return [];
		const files = await (ctx.db.query as AnyFn)("files")
			.withIndex("by_user", (q: { eq: AnyFn }) => q.eq("userId", userId))
			.order("desc")
			.collect();
		// Attach a download URL to each file
		return await Promise.all(
			(files as Array<Record<string, unknown>>).map(async (file) => ({
				...file,
				url: await ctx.storage.getUrl(file.storageId as string),
			})),
		);
	},
});
