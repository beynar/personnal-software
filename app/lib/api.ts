import { apiReference } from "@scalar/hono-api-reference";
import { OpenAPIRoute, fromHono } from "chanfana";
import { Hono } from "hono";
import { z } from "zod";
import { extractApiKey, validateApiKey } from "~/lib/api-auth";

const apiApp = new Hono().basePath("/api/v1");

// --- API-key auth middleware for all /api/v1/* requests ---
// Public paths (openapi.json, docs) are exempted so the spec stays discoverable.
apiApp.use("*", async (c, next) => {
	const path = new URL(c.req.url).pathname;
	if (path === "/api/v1/openapi.json" || path === "/api/v1/docs") {
		return next();
	}

	const apiKey = extractApiKey(c.req.raw);
	if (!apiKey) {
		return c.json({ error: "Missing x-api-key header" }, 401);
	}

	const result = await validateApiKey(apiKey);
	if (!result) {
		return c.json({ error: "Invalid or expired API key" }, 401);
	}

	// Stash the authenticated user/session for downstream handlers
	c.set("user" as never, result.user as never);
	c.set("session" as never, result.session as never);
	return next();
});

// Wire chanfana to serve the OpenAPI spec at /api/v1/openapi.json
const openapi = fromHono(apiApp, {
	docs_url: null,
	schema: {
		info: {
			title: "Bubbly Dragon API",
			version: "1.0.0",
		},
		security: [{ apiKey: [] }],
		components: {
			securitySchemes: {
				apiKey: {
					type: "apiKey",
					in: "header",
					name: "x-api-key",
				},
			},
		},
		// biome-ignore lint/suspicious/noExplicitAny: chanfana's schema type is too narrow for security/components
	} as any,
});

class TestEndpoint extends OpenAPIRoute {
	schema = {
		summary: "Test endpoint",
		description:
			"Returns a simple success response to verify the API is running.",
		responses: {
			"200": {
				description: "API is operational",
				content: {
					"application/json": {
						schema: z.object({
							success: z.boolean(),
							message: z.string(),
							timestamp: z.string(),
						}),
					},
				},
			},
		},
	};

	async handle() {
		return {
			success: true,
			message: "API is operational",
			timestamp: new Date().toISOString(),
		};
	}
}

openapi.get("/test", TestEndpoint);

// Scalar-powered API reference UI at /api/v1/docs
apiApp.get(
	"/docs",
	apiReference({
		url: "/api/v1/openapi.json",
		theme: "kepler",
		pageTitle: "Bubbly Dragon API Reference",
		authentication: {
			preferredSecurityScheme: "apiKey",
		},
	}),
);

/**
 * Returns the generated OpenAPI spec as a plain JS object.
 * Useful for programmatic access without an HTTP round-trip.
 */
function getOpenApiSpec(): Record<string, unknown> {
	// biome-ignore lint/suspicious/noExplicitAny: getGeneratedSchema exists on the underlying OpenAPIRouter but isn't exposed on the proxy type
	return (openapi as any).getGeneratedSchema() as Record<string, unknown>;
}

export { apiApp, getOpenApiSpec };
