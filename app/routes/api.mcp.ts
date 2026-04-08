import { createFileRoute } from "@tanstack/react-router";
import type { McpSession } from "~/lib/mcp-server";
import { handleMcpRequest } from "~/lib/mcp-server";

const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;

/**
 * Validates a bearer token against Better Auth's MCP get-session endpoint.
 * Returns the session if the token is valid, or null otherwise.
 */
async function validateBearerToken(token: string): Promise<McpSession | null> {
	try {
		const response = await fetch(`${convexSiteUrl}/api/auth/mcp/get-session`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!response.ok) return null;
		const data = (await response.json()) as Record<string, unknown>;
		if (!data?.user) return null;
		return data as unknown as McpSession;
	} catch {
		return null;
	}
}

/**
 * Returns a 401 response with a WWW-Authenticate header pointing to the
 * app-hosted OAuth protected-resource metadata, per RFC 9728.
 */
function unauthorizedResponse(requestUrl: string): Response {
	const origin = new URL(requestUrl).origin;
	const resourceMetadata = `${origin}/.well-known/oauth-protected-resource`;
	return new Response(
		JSON.stringify({
			jsonrpc: "2.0",
			error: { code: -32001, message: "Unauthorized" },
			id: null,
		}),
		{
			status: 401,
			headers: {
				"Content-Type": "application/json",
				"WWW-Authenticate": `Bearer resource_metadata="${resourceMetadata}"`,
			},
		},
	);
}

/**
 * Handles incoming MCP POST requests: validates bearer token, parses
 * JSON-RPC message(s), and dispatches to the MCP server handler.
 */
async function handleMcpPost(request: Request): Promise<Response> {
	const authorization = request.headers.get("Authorization");
	if (!authorization?.startsWith("Bearer ")) {
		return unauthorizedResponse(request.url);
	}

	const token = authorization.slice(7);
	const session = await validateBearerToken(token);
	if (!session) {
		return unauthorizedResponse(request.url);
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(
			JSON.stringify({
				jsonrpc: "2.0",
				error: { code: -32700, message: "Parse error" },
				id: null,
			}),
			{ status: 400, headers: { "Content-Type": "application/json" } },
		);
	}

	// Handle batch requests (array of JSON-RPC messages)
	if (Array.isArray(body)) {
		const responses = body
			.map((msg) => handleMcpRequest(msg, session))
			.filter(Boolean);
		if (responses.length === 0) {
			return new Response(null, { status: 202 });
		}
		return new Response(JSON.stringify(responses), {
			headers: { "Content-Type": "application/json" },
		});
	}

	// Handle single request
	const result = handleMcpRequest(
		body as Parameters<typeof handleMcpRequest>[0],
		session,
	);
	if (result === null) {
		// Notification — no response body
		return new Response(null, { status: 202 });
	}

	return new Response(JSON.stringify(result), {
		headers: { "Content-Type": "application/json" },
	});
}

export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			POST: ({ request }) => handleMcpPost(request),
			OPTIONS: () =>
				new Response(null, {
					status: 204,
					headers: {
						"Access-Control-Allow-Origin": "*",
						"Access-Control-Allow-Methods": "POST, OPTIONS",
						"Access-Control-Allow-Headers":
							"Content-Type, Authorization, Accept",
					},
				}),
		},
	},
});
