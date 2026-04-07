import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const schema = defineSchema({
	...authTables,
	users: defineTable({
		name: v.optional(v.string()),
		image: v.optional(v.string()),
		email: v.optional(v.string()),
		emailVerificationTime: v.optional(v.number()),
		phone: v.optional(v.string()),
		phoneVerificationTime: v.optional(v.number()),
		isAnonymous: v.optional(v.boolean()),
	})
		.index("email", ["email"])
		.index("phone", ["phone"]),
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
