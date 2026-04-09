import { normalizeCode, resolveProvider } from "@cloudflare/codemode";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiApp } from "~/lib/api";
import { getExecutor } from "~/lib/codemode";
import { searchPublicCatalog } from "~/lib/openapi-catalog";

export const MCP_SERVER_INFO = {
	name: "bubbly-dragon",
	version: "1.0.0",
} as const;

export type McpSession = {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date | string;
	refreshTokenExpiresAt: Date | string;
	clientId: string;
	userId: string;
	scopes: string;
};

interface ExecuteInput {
	method?: string;
	path?: string;
	headers?: Record<string, string>;
	body?: unknown;
}

interface ResponseEnvelope {
	status: number;
	contentType: string | null;
	headers: Record<string, string>;
	body: unknown;
	truncated: boolean;
}

interface ApiRouteNode {
	$children: Record<string, ApiRouteNode>;
	$methods: string[];
	$segment?: string;
}

const MAX_BODY_BYTES = 128 * 1024;

const ALLOWED_HEADERS = new Set([
	"content-type",
	"content-length",
	"x-request-id",
	"retry-after",
	"cache-control",
	"etag",
	"last-modified",
	"location",
]);

function requireSession(authInfo?: AuthInfo): McpSession {
	const session = authInfo?.extra?.session;
	if (!session || typeof session !== "object") {
		throw new Error("Missing authenticated MCP session");
	}

	return session as McpSession;
}

function filterHeaders(responseHeaders: Headers): Record<string, string> {
	const filtered: Record<string, string> = {};
	for (const [key, value] of responseHeaders.entries()) {
		if (ALLOWED_HEADERS.has(key.toLowerCase())) {
			filtered[key.toLowerCase()] = value;
		}
	}
	return filtered;
}

function normalizePublicRoutePath(path?: string): string {
	const value = path ?? "/";
	const normalizedPath = value.startsWith("/api/v1")
		? value
		: `/api/v1${value.startsWith("/") ? "" : "/"}${value}`;

	if (
		normalizedPath !== "/api/v1/openapi.json" &&
		normalizedPath !== "/api/v1/docs"
	) {
		throw new Error(
			"Only public OpenAPI routes are allowed: /api/v1/openapi.json and /api/v1/docs",
		);
	}

	return normalizedPath;
}

async function executePublicRoute(
	input: ExecuteInput,
): Promise<ResponseEnvelope> {
	const method = (input.method ?? "GET").toUpperCase();
	if (method !== "GET" && method !== "HEAD") {
		throw new Error("Only GET and HEAD are allowed for public OpenAPI routes");
	}

	const path = input.path ?? "/";
	const normalizedPath = normalizePublicRoutePath(path);

	const headers = new Headers(input.headers ?? {});
	const requestInit: RequestInit = {
		method,
		headers,
	};
	const request = new Request(`http://localhost${normalizedPath}`, requestInit);
	const response = await apiApp.fetch(request);
	const rawBody = await response.arrayBuffer();
	const truncated = rawBody.byteLength > MAX_BODY_BYTES;
	const bodySlice = truncated ? rawBody.slice(0, MAX_BODY_BYTES) : rawBody;
	const bodyText = new TextDecoder().decode(bodySlice);
	const contentType = response.headers.get("content-type");

	let parsedBody: unknown = bodyText;
	if (contentType?.includes("application/json")) {
		try {
			parsedBody = JSON.parse(bodyText);
		} catch {
			parsedBody = bodyText;
		}
	}

	const envelope: ResponseEnvelope = {
		status: response.status,
		contentType,
		headers: filterHeaders(response.headers),
		body: parsedBody,
		truncated,
	};

	return envelope;
}

function segmentToProperty(segment: string): string {
	const parts = segment
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (parts.length === 0) {
		throw new Error(`Cannot build proxy name for route segment "${segment}"`);
	}

	return parts
		.map((part, index) => {
			const lower = part.toLowerCase();
			if (index === 0) return lower;
			return lower.charAt(0).toUpperCase() + lower.slice(1);
		})
		.join("");
}

function buildApiRouteTree(): ApiRouteNode {
	const root: ApiRouteNode = {
		$children: {},
		$methods: [],
	};

	for (const entry of searchPublicCatalog("")) {
		if (!entry.path.startsWith("/api/v1/")) continue;
		const segments = entry.path
			.replace(/^\/api\/v1\/?/, "")
			.split("/")
			.filter(Boolean);

		let node = root;
		for (const segment of segments) {
			const property = segmentToProperty(segment);
			const existing = node.$children[property];
			if (existing) {
				node = existing;
				continue;
			}

			const child: ApiRouteNode = {
				$children: {},
				$methods: [],
				$segment: segment,
			};
			node.$children[property] = child;
			node = child;
		}

		if (!node.$methods.includes(entry.method)) {
			node.$methods.push(entry.method);
		}
	}

	return root;
}

function buildApiProxyPrelude(): string {
	return `
const __apiTree = ${JSON.stringify(buildApiRouteTree())};
const __httpMethods = new Set(["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"]);

function __createApiProxy(node, segments) {
	return new Proxy(function apiProxy() {}, {
		get(_target, prop) {
			if (prop === "then") return undefined;
			if (typeof prop !== "string") return undefined;

			const maybeMethod = prop.toUpperCase();
			if (__httpMethods.has(maybeMethod)) {
				if (!node.$methods.includes(maybeMethod)) {
					throw new Error(\`Method \${maybeMethod} is not available at /\${segments.join("/")}\`);
				}

				return (input = {}) => {
					if (input == null || typeof input !== "object" || Array.isArray(input)) {
						throw new Error("Route input must be an object");
					}

					const path = segments.length === 0 ? "/api/v1" : \`/api/v1/\${segments.join("/")}\`;
					return openapi.callRoute({
						method: maybeMethod,
						path,
						headers: input.headers,
					});
				};
			}

			const child = node.$children[prop];
			if (!child) {
				throw new Error(\`Unknown API route segment "\${prop}" at /\${segments.join("/")}\`);
			}

			return __createApiProxy(child, [...segments, child.$segment]);
		},
	});
}

const api = __createApiProxy(__apiTree, []);
`;
}

async function executeSandboxedCode(code: string): Promise<{
	result: unknown;
	logs: string[];
}> {
	const provider = resolveProvider({
		name: "openapi",
		tools: {
			callRoute: {
				description:
					"Call a public OpenAPI route through the host. Input: { method?: string, path?: string, headers?: Record<string, string> }.",
				execute: async (input: unknown) => {
					if (!input || typeof input !== "object") {
						throw new Error("callRoute requires an object input");
					}
					return executePublicRoute(input as ExecuteInput);
				},
			},
		},
	});

	const normalizedUserCode = normalizeCode(code);
	const wrappedCode = `async () => {
${buildApiProxyPrelude()}
	const __userCode = (${normalizedUserCode});
	return await __userCode();
}`;

	const execution = await getExecutor().execute(wrappedCode, [provider]);
	if (execution.error) {
		const logs =
			execution.logs && execution.logs.length > 0
				? `\n\nConsole output:\n${execution.logs.join("\n")}`
				: "";
		throw new Error(`Code execution failed: ${execution.error}${logs}`);
	}

	return {
		result: execution.result,
		logs: execution.logs ?? [],
	};
}

export function createAuthInfo(session: McpSession): AuthInfo {
	return {
		token: session.accessToken,
		clientId: session.clientId,
		scopes: [],
		expiresAt: Math.floor(
			new Date(session.accessTokenExpiresAt).getTime() / 1000,
		),
		extra: {
			session,
		},
	};
}

export function registerMcpTools(server: McpServer): void {
	server.registerTool(
		"search-routes",
		{
			title: "Search Routes",
			description:
				"Search the public OpenAPI route catalog by keyword. Returns matching routes with method, path, summary, and schema information.",
			inputSchema: z.object({
				query: z
					.string()
					.describe(
						"Keyword to search for in route paths, summaries, descriptions, and tags.",
					),
			}),
		},
		async ({ query }) => ({
			content: [
				{
					type: "text",
					text: JSON.stringify(searchPublicCatalog(query), null, 2),
				},
			],
		}),
	);

	server.registerTool(
		"execute",
		{
			title: "Execute Code",
			description:
				"Execute JavaScript inside a Cloudflare dynamic worker sandbox. The sandbox exposes an api.* recursive proxy over the public OpenAPI routes. Example: api.openapiJson.get() or api.docs.get(). Only the public routes /api/v1/openapi.json and /api/v1/docs can be called.",
			inputSchema: z.object({
				code: z
					.string()
					.describe("JavaScript async arrow function to execute."),
			}),
		},
		async ({ code }, extra) => {
			requireSession(extra.authInfo);
			const execution = await executeSandboxedCode(code);
			return {
				content: [
					{
						type: "text",
						text: JSON.stringify(execution, null, 2),
					},
				],
			};
		},
	);
}
