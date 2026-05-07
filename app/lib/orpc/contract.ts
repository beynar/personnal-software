import { oc } from "@orpc/contract";
import { z } from "zod";

const exampleParamsSchema = z.object({
	exampleId: z.string().min(1),
});

function parseBooleanQueryValue(value: unknown): unknown {
	if (typeof value === "boolean" || value === undefined) {
		return value;
	}

	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		if (normalized === "true") {
			return true;
		}
		if (normalized === "false") {
			return false;
		}
	}

	return value;
}

const exampleQuerySchema = z.object({
	q: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(20).default(10),
	dryRun: z.preprocess(parseBooleanQueryValue, z.boolean()).default(false),
	channel: z.enum(["email", "sms", "push"]).default("email"),
});

const exampleBodySchema = z.object({
	message: z.string().min(1),
	priority: z.enum(["low", "normal", "high"]).default("normal"),
});

const exampleResponseSchema = z.object({
	success: z.boolean(),
	received: z.object({
		exampleId: z.string(),
		query: z.object({
			q: z.string(),
			limit: z.number().int(),
			dryRun: z.boolean(),
			channel: z.enum(["email", "sms", "push"]),
		}),
		body: z.object({
			message: z.string(),
			priority: z.enum(["low", "normal", "high"]),
		}),
	}),
	preview: z.array(z.string()),
	message: z.string(),
});

const productFiltersSchema = z.object({
	search: z.string().optional(),
	zone: z.enum(["A", "B", "C", "D", "F", "G", "H", "Outdoor"]).optional(),
	category: z
		.enum([
			"Fauteuil",
			"Chaise",
			"Canapé",
			"Pouf",
			"Table",
			"Bureau",
			"Table basse",
			"Table lounge",
			"Meuble nuit",
			"Bibliothèque",
			"Banc",
			"Lit",
			"Matelas",
			"Plaid",
			"Tapis",
			"Coussin",
			"Cuisine",
			"Dressing",
		])
		.optional(),
	type: z.enum(["all", "standalone", "composition", "module"]).default("all"),
	status: z.enum(["all", "calculated", "incomplete", "sold"]).default("all"),
});

const molteniCategorySchema = z.enum([
	"Fauteuil",
	"Chaise",
	"Canapé",
	"Pouf",
	"Table",
	"Bureau",
	"Table basse",
	"Table lounge",
	"Meuble nuit",
	"Bibliothèque",
	"Banc",
	"Lit",
	"Matelas",
	"Plaid",
	"Tapis",
	"Coussin",
	"Cuisine",
	"Dressing",
]);

const ecomaisonFamilySchema = z.enum([
	"Meuble",
	"Siège sans rembourrage",
	"Siège avec rembourrage",
	"Literie",
	"Décoration textile",
]);

const materialTierSchema = z.enum([
	"bois_massif_95",
	"bois_75",
	"bois_50",
	"metal_95",
	"metal_75",
	"metal_50",
	"plastique_95",
	"plastique",
	"synthetique_95",
	"synthetique_50",
	"ceramique",
	"biosource_50",
	"tous_materiaux",
]);

const createProductBodySchema = z.object({
	name: z.string().min(1),
	variantLabel: z.string().optional(),
	reference: z.string().optional(),
	zone: z.enum(["A", "B", "C", "D", "F", "G", "H", "Outdoor"]).optional(),
	molteniCategory: molteniCategorySchema,
	ecomaisonFamily: ecomaisonFamilySchema,
	materialTier: materialTierSchema.optional(),
	isComposition: z.boolean().default(false),
	parentId: z.string().optional(),
	moduleKind: z.enum(["base", "component"]).optional(),
	createBaseModule: z.boolean().optional(),
	notes: z.string().optional(),
	hasRecyclingDisruptors: z.boolean().default(false),
	sustainableCertified: z.boolean().default(false),
	evolutionaryDesign: z.boolean().default(false),
	weightKg: z.number().optional(),
	widthCm: z.number().optional(),
	textileMode: z.enum(["weight", "surface", "piece"]).optional(),
	priceHt: z.number().optional(),
	fabricReference: z.string().optional(),
	tvaRate: z.number().default(0.2),
});

const addVariantBodySchema = z.object({
	variantLabel: z.string().min(1),
	reference: z.string().optional(),
	fabricReference: z.string().optional(),
	priceHt: z.number().optional(),
	weightKg: z.number().optional(),
	widthCm: z.number().optional(),
	textileMode: z.enum(["weight", "surface", "piece"]).optional(),
});

const declarationQuerySchema = z.object({
	year: z.coerce.number().int().min(2026).max(2100).default(2026),
	quarter: z.enum(["T1", "T2", "T3", "T4"]).default("T1"),
	soldOnly: z.preprocess(parseBooleanQueryValue, z.boolean()).default(true),
});

const productIdParamsSchema = z.object({
	productId: z.string().min(1),
});

const variantIdParamsSchema = z.object({
	variantId: z.string().min(1),
});

/**
 * Canonical machine contract for the starter's OpenAPI and MCP surface.
 * New user or agent capabilities should be added here first.
 */
export const apiContract = {
	examples: {
		workflow: oc
			.route({
				method: "POST",
				path: "/api/v1/examples/{exampleId}/workflow",
				inputStructure: "detailed",
				summary: "Example workflow route",
				description:
					"Example route for MCP and OpenAPI integration. It intentionally combines path params, query params, a JSON body, and a typed response so LLMs can learn the proxy shape from one route. Remove it once real product routes are available.",
				tags: ["examples"],
			})
			.input(
				z.object({
					params: exampleParamsSchema,
					query: exampleQuerySchema,
					body: exampleBodySchema,
				}),
			)
			.output(exampleResponseSchema),
	},
	molteni: {
		dashboard: oc
			.route({
				method: "GET",
				path: "/api/v1/molteni/dashboard",
				summary: "Molteni dashboard data",
				tags: ["molteni"],
			})
			.output(z.any()),
		products: oc
			.route({
				method: "GET",
				path: "/api/v1/molteni/products",
				inputStructure: "detailed",
				summary: "List Molteni products",
				tags: ["molteni"],
			})
			.input(z.object({ query: productFiltersSchema }))
			.output(z.any()),
		createProduct: oc
			.route({
				method: "POST",
				path: "/api/v1/molteni/products",
				inputStructure: "detailed",
				summary: "Create Molteni product",
				description:
					"Creates a product with its default exhibited variant and recalculates eco-participation when enough data is available.",
				tags: ["molteni", "products"],
			})
			.input(z.object({ body: createProductBodySchema }))
			.output(z.object({ productId: z.string() })),
		updateProduct: oc
			.route({
				method: "PATCH",
				path: "/api/v1/molteni/products/{productId}",
				inputStructure: "detailed",
				summary: "Update Molteni product",
				description:
					"Updates product classification fields and the exhibited default variant when the product is not a composition.",
				tags: ["molteni", "products"],
			})
			.input(
				z.object({
					params: productIdParamsSchema,
					body: createProductBodySchema,
				}),
			)
			.output(z.object({ ok: z.boolean() })),
		product: oc
			.route({
				method: "GET",
				path: "/api/v1/molteni/products/{productId}",
				inputStructure: "detailed",
				summary: "Get Molteni product detail",
				tags: ["molteni"],
			})
			.input(z.object({ params: productIdParamsSchema }))
			.output(z.any()),
		addVariant: oc
			.route({
				method: "POST",
				path: "/api/v1/molteni/products/{productId}/variants",
				inputStructure: "detailed",
				summary: "Add product variant",
				description:
					"Adds a variant to an existing product and calculates its eco-participation from the product classification and variant measurements.",
				tags: ["molteni", "products", "variants"],
			})
			.input(
				z.object({
					params: productIdParamsSchema,
					body: addVariantBodySchema,
				}),
			)
			.output(z.object({ variantId: z.string() })),
		setProductSoldDate: oc
			.route({
				method: "PATCH",
				path: "/api/v1/molteni/products/{productId}/sold-date",
				inputStructure: "detailed",
				summary: "Set product sold date",
				description:
					"Marks the whole exhibited product as sold or clears its sold state. Sold date is product-level, not variant-level.",
				tags: ["molteni", "products"],
			})
			.input(
				z.object({
					params: productIdParamsSchema,
					body: z.object({ soldDate: z.string().nullable() }),
				}),
			)
			.output(z.object({ ok: z.boolean() })),
		deleteProduct: oc
			.route({
				method: "DELETE",
				path: "/api/v1/molteni/products/{productId}",
				inputStructure: "detailed",
				summary: "Soft delete product",
				description:
					"Soft-deletes a product from active inventory and declaration screens.",
				tags: ["molteni", "products"],
			})
			.input(z.object({ params: productIdParamsSchema }))
			.output(z.object({ ok: z.boolean() })),
		setVariantEcomaisonCode: oc
			.route({
				method: "PATCH",
				path: "/api/v1/molteni/variants/{variantId}/ecomaison-code",
				inputStructure: "detailed",
				summary: "Set variant Ecomaison code",
				description:
					"Stores or clears a manual 11-digit Ecomaison code override for a variant.",
				tags: ["molteni", "variants"],
			})
			.input(
				z.object({
					params: variantIdParamsSchema,
					body: z.object({
						code: z
							.string()
							.regex(/^\d{11}$/)
							.nullable(),
					}),
				}),
			)
			.output(z.object({ ok: z.boolean() })),
		declaration: oc
			.route({
				method: "GET",
				path: "/api/v1/molteni/declaration",
				inputStructure: "detailed",
				summary: "Quarterly Ecomaison declaration data",
				tags: ["molteni"],
			})
			.input(z.object({ query: declarationQuerySchema }))
			.output(z.any()),
	},
} as const;

export type ExampleWorkflowInput = z.input<
	(typeof apiContract.examples.workflow)["~orpc"]["inputSchema"]
>;
