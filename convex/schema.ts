import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
	// App users — synced from Better Auth component via user triggers.
	// Additional profile fields can be added here freely.
	users: defineTable({
		name: v.optional(v.string()),
		username: v.optional(v.string()),
		bio: v.optional(v.string()),
		image: v.optional(v.string()),
		imageStorageId: v.optional(v.id("_storage")),
		email: v.optional(v.string()),
	})
		.index("email", ["email"])
		.index("by_username", ["username"]),
	// Shared counter — demonstrates Convex real-time subscriptions.
	counters: defineTable({
		name: v.string(),
		value: v.number(),
	}).index("by_name", ["name"]),
	// File storage metadata — tracks uploaded files with owner reference
	files: defineTable({
		storageId: v.id("_storage"),
		name: v.string(),
		size: v.number(),
		type: v.string(),
		uploadedAt: v.number(),
		userId: v.id("users"),
	}).index("by_user", ["userId"]),
});

export default schema;
