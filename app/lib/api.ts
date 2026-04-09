import { apiReference } from "@scalar/hono-api-reference";
import { OpenAPIRoute, fromHono } from "chanfana";
import { Hono } from "hono";
import { z } from "zod";
import {
	extractApiKey,
	extractBearerApiKey,
	validateApiKey,
} from "~/lib/api-auth";
import { auth } from "~/lib/auth";
import { PROJECT_NAME } from "~/lib/project";

const apiApp = new Hono().basePath("/api/v1");

// --- API-key auth middleware for all /api/v1/* requests ---
// Public paths (openapi.json, docs) are exempted so the spec stays discoverable.
apiApp.use("*", async (c, next) => {
	const path = new URL(c.req.url).pathname;
	if (path === "/api/v1/openapi.json" || path === "/api/v1/docs") {
		return next();
	}

	const bearerApiKey = extractBearerApiKey(c.req.raw);
	const headerApiKey = extractApiKey(c.req.raw);
	const apiKeyAuth = bearerApiKey
		? await validateApiKey(bearerApiKey)
		: headerApiKey
			? await validateApiKey(headerApiKey)
			: null;

	if (apiKeyAuth) {
		c.set("user" as never, apiKeyAuth.user as never);
		c.set("session" as never, apiKeyAuth.session as never);
		return next();
	}

	const mcpSession = await auth.api
		.getMcpSession({
			headers: c.req.raw.headers,
		})
		.catch(() => null);

	if (!mcpSession) {
		return c.json(
			{
				error:
					"Missing or invalid API credentials. Use Authorization: Bearer <api-key>, x-api-key, or MCP session auth.",
			},
			401,
		);
	}

	// Stash the authenticated user/session for downstream handlers
	c.set("session" as never, mcpSession as never);
	return next();
});

// Wire chanfana to serve the OpenAPI spec at /api/v1/openapi.json
const openapi = fromHono(apiApp, {
	docs_url: null,
	schema: {
		info: {
			title: `${PROJECT_NAME} API`,
			version: "1.0.0",
		},
		security: [{ bearerAuth: [] }],
		components: {
			securitySchemes: {
				bearerAuth: {
					type: "http",
					scheme: "bearer",
					description: "Send the API key as Authorization: Bearer <api-key>.",
				},
			},
		},
		// biome-ignore lint/suspicious/noExplicitAny: chanfana's schema type is too narrow for security/components
	} as any,
});

class ExampleWorkflowEndpoint extends OpenAPIRoute {
	schema = {
		summary: "Example workflow route",
		description:
			"Example route for MCP and OpenAPI integration. It intentionally combines path params, query params, a JSON body, and a typed response so LLMs can learn the proxy shape from one route. Remove it once real product routes are available.",
		request: {
			params: z.object({
				exampleId: z.string().min(1),
			}),
			query: z.object({
				q: z.string().min(1),
				limit: z.number().int().min(1).max(20).default(10),
				dryRun: z.boolean().default(false),
				channel: z.enum(["email", "sms", "push"]).default("email"),
			}),
			body: {
				required: true,
				content: {
					"application/json": {
						schema: z.object({
							message: z.string().min(1),
							priority: z.enum(["low", "normal", "high"]).default("normal"),
						}),
					},
				},
			},
		},
		responses: {
			"200": {
				description: "All request parts echoed back",
				content: {
					"application/json": {
						schema: z.object({
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
						}),
					},
				},
			},
		},
	};

	async handle() {
		const { params, query, body } =
			await this.getValidatedData<typeof this.schema>();
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
	}
}

openapi.post("/examples/:exampleId/workflow", ExampleWorkflowEndpoint);

// Scalar-powered API reference UI at /api/v1/docs
apiApp.get(
	"/docs",
	apiReference({
		url: "/api/v1/openapi.json",
		pageTitle: `${PROJECT_NAME} API Reference`,
		layout: "modern",
		defaultOpenAllTags: true,
		expandAllModelSections: true,
		expandAllResponses: true,
		hideModels: true,
		hideClientButton: true,
		showSidebar: true,
		showDeveloperTools: "always",
		operationTitleSource: "summary",
		theme: "deepSpace",
		persistAuth: true,
		telemetry: true,
		isEditable: false,
		isLoading: false,
		documentDownloadType: "none",
		hideTestRequestButton: false,
		hideSearch: true,
		hideDarkModeToggle: false,
		withDefaultFonts: true,
		defaultOpenFirstTag: true,
		orderSchemaPropertiesBy: "alpha",
		orderRequiredPropertiesFirst: true,
		_integration: "hono",
		hideDownloadButton: true,
		customCss:
			'[aria-label="Developer Tools"] {display: none !important; } \n .scalar-mcp-layer { display: none !important;  } \n a[href="https://www.scalar.com"] { display: none !important; }\n .agent-button-container { display: none !important; }\n  ',
		default: false,
		authentication: {
			preferredSecurityScheme: "httpBearer",
			securitySchemes: {
				httpBearer: {
					scheme: "bearer",
					token: "API key",
				},
			},
		},
	}),
);

/**
 * Returns the generated OpenAPI spec as a plain JS object.
 * Useful for programmatic access without an HTTP round-trip.
 */
function getOpenApiSpec(): Record<string, unknown> {
	return openapi.schema as Record<string, unknown>;
}

export { apiApp, getOpenApiSpec };
