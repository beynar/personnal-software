import type { Register } from "@tanstack/react-router";
import {
	type RequestHandler,
	createStartHandler,
	defaultStreamHandler,
} from "@tanstack/react-start/server";

const startFetch = createStartHandler(defaultStreamHandler);

const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;

const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Accept",
} as const;

function jsonResponse(body: Record<string, unknown>): Response {
	return new Response(JSON.stringify(body), {
		headers: {
			"Content-Type": "application/json",
			...CORS_HEADERS,
		},
	});
}

/**
 * RFC 8414 — OAuth Authorization Server Metadata.
 * Describes the Better Auth authority so MCP clients know where to
 * authorize, exchange tokens, and register dynamic clients.
 */
function handleOAuthAuthorizationServer(): Response {
	const issuer = `${convexSiteUrl}/api/auth`;
	return jsonResponse({
		issuer,
		authorization_endpoint: `${issuer}/mcp/authorize`,
		token_endpoint: `${issuer}/mcp/token`,
		registration_endpoint: `${issuer}/mcp/register`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code"],
		token_endpoint_auth_methods_supported: ["client_secret_post"],
		code_challenge_methods_supported: ["S256"],
		scopes_supported: ["mcp:tools"],
	});
}

/**
 * RFC 9728 — OAuth Protected Resource Metadata.
 * Describes the MCP server endpoint and points clients to the
 * authorization server they need to obtain tokens from.
 */
function handleOAuthProtectedResource(origin: string): Response {
	return jsonResponse({
		resource: `${origin}/api/mcp`,
		authorization_servers: [`${convexSiteUrl}/api/auth`],
		bearer_methods_supported: ["header"],
		scopes_supported: ["mcp:tools"],
	});
}

export type ServerEntry = { fetch: RequestHandler<Register> };

function createServerEntry(entry: ServerEntry): ServerEntry {
	return {
		async fetch(...args) {
			const request = args[0];
			const url = new URL(request.url);

			// Handle .well-known discovery endpoints before TanStack Start routing
			if (url.pathname === "/.well-known/oauth-authorization-server") {
				if (request.method === "OPTIONS") {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				}
				return handleOAuthAuthorizationServer();
			}
			if (url.pathname === "/.well-known/oauth-protected-resource") {
				if (request.method === "OPTIONS") {
					return new Response(null, { status: 204, headers: CORS_HEADERS });
				}
				return handleOAuthProtectedResource(url.origin);
			}

			return await entry.fetch(...args);
		},
	};
}

export default createServerEntry({ fetch: startFetch });
