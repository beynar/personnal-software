import { apiReference } from "@scalar/hono-api-reference";
import { fromHono } from "chanfana";
import { Hono } from "hono";

const app = new Hono().basePath("/api/v1");

// Wire chanfana to serve the OpenAPI spec at /api/v1/openapi.json
fromHono(app, {
	docs_url: null,
	schema: {
		info: {
			title: "Bubbly Dragon API",
			version: "1.0.0",
		},
	},
});

// Scalar-powered API reference UI at /api/v1/docs
app.get(
	"/docs",
	apiReference({
		url: "/api/v1/openapi.json",
		theme: "kepler",
	}),
);

export { app };
