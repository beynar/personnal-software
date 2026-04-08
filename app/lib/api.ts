import { apiReference } from "@scalar/hono-api-reference";
import { OpenAPIRoute, fromHono } from "chanfana";
import { Hono } from "hono";
import { z } from "zod";

const app = new Hono().basePath("/api/v1");

// Wire chanfana to serve the OpenAPI spec at /api/v1/openapi.json
const openapi = fromHono(app, {
	docs_url: null,
	schema: {
		info: {
			title: "Bubbly Dragon API",
			version: "1.0.0",
		},
	},
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
app.get(
	"/docs",
	apiReference({
		url: "/api/v1/openapi.json",
		theme: "kepler",
	}),
);

export { app };
