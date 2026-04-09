import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createFileRoute } from "@tanstack/react-router";
import { extractApiKey, validateApiKey } from "~/lib/api-auth";
import {
	MCP_SERVER_INFO,
	type McpSession,
	createAuthInfo,
	registerMcpTools,
} from "~/lib/mcp";

const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL as string;
const CORS_HEADERS = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
	"Access-Control-Allow-Headers":
		"Content-Type, Authorization, Accept, x-api-key, mcp-session-id, mcp-protocol-version, last-event-id",
	"Access-Control-Expose-Headers": "mcp-session-id, mcp-protocol-version",
} as const;

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
		const session = data as unknown as Omit<McpSession, "credential">;
		return { ...session, credential: { type: "bearer", token } };
	} catch {
		return null;
	}
}

/**
 * Validates an API key via Better Auth's get-session endpoint (with
 * enableSessionForAPIKeys). Returns an McpSession or null.
 */
async function validateApiKeySession(
	apiKey: string,
): Promise<McpSession | null> {
	const result = await validateApiKey(apiKey);
	if (!result) return null;
	return {
		user: {
			id: result.user.id,
			email: result.user.email,
			name: result.user.name,
			createdAt: String(result.user.createdAt),
		},
		session: {
			id: result.session.id,
			expiresAt: String(result.session.expiresAt),
		},
		credential: { type: "api-key", apiKey },
	};
}

/**
 * Returns a 401 response with a WWW-Authenticate header pointing to the
 * app-hosted OAuth protected-resource metadata, per RFC 9728.
 */
function withCors(response: Response): Response {
	const headers = new Headers(response.headers);
	for (const [key, value] of Object.entries(CORS_HEADERS)) {
		headers.set(key, value);
	}
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}

function unauthorizedResponse(request: Request): Response {
	if (request.method !== "GET" && request.method !== "HEAD") {
		const headers = new Headers(CORS_HEADERS);
		headers.set("Location", request.url);
		return new Response(null, {
			status: 303,
			headers,
		});
	}

	const requestUrl = request.url;
	const origin = new URL(requestUrl).origin;
	const resourceMetadata = `${origin}/oauth-protected-resource`;
	const headers = new Headers(CORS_HEADERS);
	headers.set(
		"WWW-Authenticate",
		`Bearer resource_metadata="${resourceMetadata}"`,
	);
	return new Response(null, {
		status: 401,
		headers,
	});
}

function createMcpServer(): McpServer {
	const server = new McpServer(MCP_SERVER_INFO);
	registerMcpTools(server);
	return server;
}

async function handleMcpRequest(
	request: Request,
	authInfo: ReturnType<typeof createAuthInfo>,
): Promise<Response> {
	const transport = new WebStandardStreamableHTTPServerTransport({
		enableJsonResponse: true,
		sessionIdGenerator: undefined,
	});
	const server = createMcpServer();

	try {
		await server.connect(transport);
		return await transport.handleRequest(request, { authInfo });
	} finally {
		await transport.close();
		await server.close();
	}
}

async function handleMcpTransport(request: Request): Promise<Response> {
	const apiKey = extractApiKey(request);
	if (apiKey) {
		const session = await validateApiKeySession(apiKey);
		if (!session) {
			return unauthorizedResponse(request);
		}
		return withCors(await handleMcpRequest(request, createAuthInfo(session)));
	}

	const authorization = request.headers.get("authorization");
	const [scheme, token] = authorization?.split(" ") ?? [];
	if (scheme?.toLowerCase() !== "bearer" || !token) {
		return unauthorizedResponse(request);
	}

	const session = await validateBearerToken(token);
	if (!session) {
		return unauthorizedResponse(request);
	}

	return withCors(await handleMcpRequest(request, createAuthInfo(session)));
}

export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			GET: ({ request }) => handleMcpTransport(request),
			POST: ({ request }) => handleMcpTransport(request),
			DELETE: ({ request }) => handleMcpTransport(request),
			OPTIONS: () =>
				new Response(null, {
					status: 204,
					headers: CORS_HEADERS,
				}),
		},
	},
});
