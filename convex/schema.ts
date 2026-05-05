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
	showrooms: defineTable({
		key: v.string(),
		name: v.string(),
		isActive: v.boolean(),
	}).index("by_key", ["key"]),
	products: defineTable({
		name: v.string(),
		molteniCategory: v.string(),
		ecomaisonFamily: v.string(),
		materialTier: v.optional(v.string()),
		zone: v.optional(v.string()),
		hasRecyclingDisruptors: v.optional(v.union(v.boolean(), v.null())),
		sustainableCertified: v.optional(v.union(v.boolean(), v.null())),
		evolutionaryDesign: v.optional(v.union(v.boolean(), v.null())),
		isComposition: v.boolean(),
		moduleKind: v.optional(v.union(v.literal("base"), v.literal("component"))),
		parentId: v.optional(v.id("products")),
		showroomId: v.id("showrooms"),
		notes: v.optional(v.string()),
		status: v.string(),
		soldDate: v.optional(v.string()),
		tvaRate: v.number(),
		createdByUserId: v.optional(v.id("users")),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index("by_showroom", ["showroomId"])
		.index("by_showroom_and_status", ["showroomId", "status"])
		.index("by_showroom_and_status_and_zone", ["showroomId", "status", "zone"])
		.index("by_showroom_and_status_and_category", [
			"showroomId",
			"status",
			"molteniCategory",
		])
		.index("by_parent", ["parentId"])
		.index("by_showroom_and_category", ["showroomId", "molteniCategory"])
		.searchIndex("search_name", {
			searchField: "name",
			filterFields: ["showroomId", "status"],
		}),
	productVariants: defineTable({
		productId: v.id("products"),
		variantLabel: v.string(),
		reference: v.optional(v.string()),
		fabricReference: v.optional(v.string()),
		priceHt: v.optional(v.number()),
		weightKg: v.optional(v.number()),
		widthCm: v.optional(v.number()),
		textileMode: v.optional(v.string()),
		ecoParticipationHt: v.optional(v.number()),
		ecoParticipationTtc: v.optional(v.number()),
		ecomaisonCode11: v.optional(v.string()),
		isEcomaisonCodeManual: v.boolean(),
		manualEcomaisonCode11: v.optional(v.string()),
		createdAt: v.number(),
		updatedAt: v.number(),
	}).index("by_product", ["productId"]),
	ecomaisonCodeMappings: defineTable({
		segment: v.string(),
		key: v.string(),
		code: v.string(),
		source: v.string(),
	}).index("by_segment_and_key", ["segment", "key"]),
});

export default schema;
