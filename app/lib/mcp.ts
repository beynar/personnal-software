import { normalizeCode, resolveProvider } from "@cloudflare/codemode";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiApp } from "~/lib/api";
import { getExecutor } from "~/lib/codemode";
import {
	type CatalogEntry,
	buildCatalog,
	searchCatalog,
	searchPublicCatalog,
} from "~/lib/openapi-catalog";

export const MCP_SERVER_INFO = {
	name: "personnal-software",
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

type RestAuthContext = {
	headers: Record<string, string>;
};

type PathParamValue = string | number | boolean;
type QueryParamValue =
	| string
	| number
	| boolean
	| null
	| undefined
	| Array<string | number | boolean | null | undefined>;

interface ExecuteInput {
	method?: string;
	path?: string;
	params?: Record<string, PathParamValue>;
	query?: Record<string, QueryParamValue>;
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
const EXECUTABLE_ROUTE_CATALOG = buildExecutableRouteCatalog();

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

function requireRestAuth(authInfo?: AuthInfo): RestAuthContext {
	const restAuth = authInfo?.extra?.restAuth;
	if (!restAuth || typeof restAuth !== "object" || !("headers" in restAuth)) {
		throw new Error("Missing REST auth context for MCP execution");
	}

	return restAuth as RestAuthContext;
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

function normalizeApiRoutePath(path?: string): string {
	const value = path ?? "/";
	const normalizedPath = value.startsWith("/api/v1")
		? value
		: `/api/v1${value.startsWith("/") ? "" : "/"}${value}`;

	return normalizedPath;
}

function getExecutableRoute(
	method: string,
	path: string,
): CatalogEntry | undefined {
	return EXECUTABLE_ROUTE_CATALOG.find(
		(entry) => entry.method === method && entry.path === path,
	);
}

function buildForwardedHeaders(
	authInfo?: AuthInfo,
	inputHeaders?: Record<string, string>,
): Headers {
	const headers = new Headers(requireRestAuth(authInfo).headers);
	for (const [key, value] of Object.entries(inputHeaders ?? {})) {
		headers.set(key, value);
	}
	return headers;
}

function materializeRoutePath(
	templatePath: string,
	params: Record<string, PathParamValue> | undefined,
): string {
	const requiredParamNames = Array.from(
		templatePath.matchAll(/\{([^}]+)\}/g),
		(match) => match[1],
	);

	let resolvedPath = templatePath;
	for (const paramName of requiredParamNames) {
		const value = params?.[paramName];
		if (value === undefined) {
			throw new Error(`Missing required path param "${paramName}"`);
		}
		resolvedPath = resolvedPath.replace(
			`{${paramName}}`,
			encodeURIComponent(String(value)),
		);
	}

	return resolvedPath;
}

function appendQueryString(
	path: string,
	query: Record<string, QueryParamValue> | undefined,
): string {
	if (!query) return path;

	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		appendQueryValue(searchParams, key, value);
	}

	const queryString = searchParams.toString();
	return queryString ? `${path}?${queryString}` : path;
}

function appendQueryValue(
	searchParams: URLSearchParams,
	key: string,
	value: QueryParamValue,
): void {
	if (value == null) return;
	if (Array.isArray(value)) {
		for (const item of value) {
			appendQueryValue(searchParams, key, item);
		}
		return;
	}

	searchParams.append(key, String(value));
}

async function executeApiRoute(
	input: ExecuteInput,
	authInfo?: AuthInfo,
): Promise<ResponseEnvelope> {
	const method = (input.method ?? "GET").toUpperCase();
	const path = input.path ?? "/";
	const normalizedTemplatePath = normalizeApiRoutePath(path);
	const route = getExecutableRoute(method, normalizedTemplatePath);
	if (!route) {
		throw new Error(
			`Route ${method} ${normalizedTemplatePath} is not available in the executable OpenAPI catalog`,
		);
	}
	const resolvedPath = materializeRoutePath(route.path, input.params);
	const requestPath = appendQueryString(resolvedPath, input.query);

	const headers = buildForwardedHeaders(authInfo, input.headers);
	let body: BodyInit | undefined;
	if (input.body !== undefined && method !== "GET" && method !== "HEAD") {
		if (!headers.has("content-type")) {
			headers.set("content-type", "application/json");
		}
		const contentType = headers.get("content-type") ?? "";
		body = contentType.includes("application/json")
			? JSON.stringify(input.body)
			: String(input.body);
	}

	const requestInit: RequestInit = { method, headers, body };
	const request = new Request(`http://localhost${requestPath}`, requestInit);
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
	const parameterMatch = segment.match(/^\{(.+)\}$/);
	if (parameterMatch) {
		return segmentToSimpleProperty(parameterMatch[1] ?? "param");
	}

	return segmentToSimpleProperty(segment);
}

function segmentToSimpleProperty(segment: string): string {
	const parts = segment
		.replace(/[^a-zA-Z0-9]+/g, " ")
		.trim()
		.split(/\s+/)
		.filter(Boolean);
	if (parts.length === 0) {
		throw new Error(`Cannot build proxy name for route segment "${segment}"`);
	}

	return parts
		.map((part, index) => normalizePropertyPart(part, index === 0))
		.join("");
}

function normalizePropertyPart(part: string, isFirst: boolean): string {
	const cleaned = part.replace(/[^a-zA-Z0-9]/g, "");
	if (!cleaned) return "";

	if (isFirst) {
		return cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
	}

	return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

function buildApiRouteTree(): ApiRouteNode {
	const root: ApiRouteNode = {
		$children: {},
		$methods: [],
	};

	for (const entry of EXECUTABLE_ROUTE_CATALOG) {
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
						params: input.params,
						query: input.query,
						headers: input.headers,
						body: input.body,
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

async function executeSandboxedCode(
	code: string,
	authInfo?: AuthInfo,
): Promise<{
	result: unknown;
	logs: string[];
}> {
	const provider = resolveProvider({
		name: "openapi",
		tools: {
			callRoute: {
				inputSchema: z.object({
					method: z.string().optional(),
					path: z.string().optional(),
					params: z
						.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
						.optional(),
					query: z
						.record(
							z.string(),
							z.union([
								z.string(),
								z.number(),
								z.boolean(),
								z.null(),
								z.array(
									z.union([z.string(), z.number(), z.boolean(), z.null()]),
								),
							]),
						)
						.optional(),
					headers: z.record(z.string(), z.string()).optional(),
					body: z.unknown().optional(),
				}),
				description:
					"Call an OpenAPI route through the host. Input: { method?: string, path?: string, params?: Record<string, string | number | boolean>, query?: Record<string, string | number | boolean | null | Array<string | number | boolean | null>>, headers?: Record<string, string>, body?: unknown }.",
				execute: async (input: unknown) => {
					requireSession(authInfo);
					return executeApiRoute(input as ExecuteInput, authInfo);
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

export function createRestAuthHeaders(
	headers: Headers,
): Record<string, string> {
	const forwarded = new Headers();
	const apiKey = headers.get("x-api-key");
	if (apiKey) {
		forwarded.set("authorization", `Bearer ${apiKey}`);
		return Object.fromEntries(forwarded.entries());
	}

	const authorization = headers.get("authorization");
	if (authorization) {
		forwarded.set("authorization", authorization);
	}

	return Object.fromEntries(forwarded.entries());
}

function buildExecutableRouteCatalog(): CatalogEntry[] {
	const entries = [...buildCatalog(), ...searchPublicCatalog("")];
	const deduped = new Map<string, CatalogEntry>();
	for (const entry of entries) {
		deduped.set(`${entry.method}:${entry.path}`, entry);
	}
	return [...deduped.values()];
}

export function registerMcpTools(server: McpServer): void {
	server.registerTool(
		"search-routes",
		{
			title: "Search Routes",
			description:
				"Search the OpenAPI route catalog. Use this to find relevant API operations before executing requests.",
			inputSchema: z.object({
				query: z
					.string()
					.describe(
						"Search text. You may provide a single query or a comma-separated list of queries. Search matches route methods, paths, summaries, descriptions, tags, parameters, and schema summaries.",
					),
			}),
		},
		async ({ query }) => {
			const normalizedQueries = Array.from(
				new Set(
					query
						.split(",")
						.map((item) => item.trim())
						.filter(Boolean),
				),
			);

			const payload =
				normalizedQueries.length === 1
					? formatRouteSearchResults(searchCatalog(normalizedQueries[0] ?? ""))
					: normalizedQueries
							.map((item) =>
								[
									`query: ${item}`,
									formatRouteSearchResults(searchCatalog(item)),
								].join("\n"),
							)
							.join("\n\n---\n\n");

			return {
				content: [
					{
						type: "text",
						text: payload,
					},
				],
			};
		},
	);

	server.registerTool(
		"execute",
		{
			title: "Execute Code",
			description:
				'Execute JavaScript inside a Cloudflare dynamic worker sandbox. The sandbox exposes an `api.*` proxy derived from executable OpenAPI routes. Use `search-routes` first to discover available routes and their input/output types, then call them with route-shaped code such as `await api.examples.exampleId.workflow.post({ params: { exampleId: "sample" }, query: { q: "widget", limit: 5, dryRun: true, channel: "email" }, body: { message: "hello", priority: "high" } })`. Parameterized path segments become plain parameter-name properties in the proxy. Route method calls accept an object with optional `params`, `query`, `headers`, and `body`. The submitted code must be an async arrow function.',
			inputSchema: z.object({
				code: z
					.string()
					.describe("JavaScript async arrow function to execute."),
			}),
		},
		async ({ code }, extra) => {
			requireSession(extra.authInfo);
			const execution = await executeSandboxedCode(code, extra.authInfo);
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

function formatRouteSearchResults(entries: CatalogEntry[]): string {
	if (entries.length === 0) {
		return "No matching routes found.";
	}

	return entries.map(formatRouteEntry).join("\n\n---\n\n");
}

function formatRouteEntry(entry: CatalogEntry): string {
	const description = entry.description || entry.summary || "No description.";
	return [
		`${entry.method} ${entry.path}`,
		description,
		"",
		"input:",
		entry.inputType,
		"",
		"output:",
		entry.outputType,
	].join("\n");
}
