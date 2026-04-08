/**
 * MCP execute tool — host-side authenticated request proxying.
 *
 * Sandboxed code calls this tool (via codemode.request() or MCP tools/call)
 * instead of making direct HTTP requests with embedded credentials.
 * The host forwards the caller's original credential into apiApp.fetch(...)
 * so protected /api/v1 routes receive proper authentication.
 *
 * Response envelope is bounded: large bodies are truncated, only safe
 * headers are exposed, and JSON bodies are parsed when possible.
 */

import { apiApp } from "~/lib/api";
import type { McpSession } from "~/lib/mcp-server";

/** Maximum response body size before truncation (128 KB). */
const MAX_BODY_BYTES = 128 * 1024;

/** Headers safe to expose in the response envelope. */
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
	/** Present when bearer auth cannot reach API-key-only routes. */
	authNote?: string;
}

/**
 * Forwards the caller's original credential into the outgoing request.
 * - api-key credentials set the x-api-key header.
 * - bearer credentials set the Authorization header, but API-key-only
 *   routes will reject them — the response envelope notes this limitation.
 */
function applyCredential(
	headers: Headers,
	credential: McpSession["credential"],
): string | undefined {
	if (credential.type === "api-key") {
		headers.set("x-api-key", credential.apiKey);
		return undefined;
	}
	// Bearer tokens from OAuth MCP sessions cannot authenticate against
	// API-key-only REST routes. Forward the token anyway so any future
	// bearer-aware middleware can use it, and surface the limitation.
	headers.set("Authorization", `Bearer ${credential.token}`);
	return "Bearer tokens from MCP OAuth sessions cannot authenticate against API-key-only REST routes. Use an API key for full access.";
}

/**
 * Filters response headers to the allowed set.
 */
function filterHeaders(responseHeaders: Headers): Record<string, string> {
	const filtered: Record<string, string> = {};
	for (const [key, value] of responseHeaders.entries()) {
		if (ALLOWED_HEADERS.has(key.toLowerCase())) {
			filtered[key.toLowerCase()] = value;
		}
	}
	return filtered;
}

/**
 * Executes an API request through apiApp.fetch() with credential forwarding.
 * Returns a bounded response envelope.
 */
export async function executeApiRequest(
	input: ExecuteInput,
	session: McpSession,
): Promise<ResponseEnvelope> {
	const method = (input.method ?? "GET").toUpperCase();
	const path = input.path ?? "/";

	// Ensure path targets the API — prefix with /api/v1 if not already
	const normalizedPath = path.startsWith("/api/v1")
		? path
		: `/api/v1${path.startsWith("/") ? "" : "/"}${path}`;

	// Build the request
	const headers = new Headers(input.headers ?? {});
	const authNote = applyCredential(headers, session.credential);

	if (!headers.has("content-type") && input.body !== undefined) {
		headers.set("content-type", "application/json");
	}

	const requestInit: RequestInit = {
		method,
		headers,
	};
	if (input.body !== undefined && method !== "GET" && method !== "HEAD") {
		requestInit.body =
			typeof input.body === "string" ? input.body : JSON.stringify(input.body);
	}

	// Use a synthetic URL — apiApp.fetch() only inspects pathname
	const url = `http://localhost${normalizedPath}`;
	const request = new Request(url, requestInit);

	const response = await apiApp.fetch(request);

	// Read body with truncation
	const rawBody = await response.arrayBuffer();
	const truncated = rawBody.byteLength > MAX_BODY_BYTES;
	const bodySlice = truncated ? rawBody.slice(0, MAX_BODY_BYTES) : rawBody;
	const bodyText = new TextDecoder().decode(bodySlice);

	// Try to parse as JSON
	const contentType = response.headers.get("content-type");
	let parsedBody: unknown = bodyText;
	if (contentType?.includes("application/json")) {
		try {
			parsedBody = JSON.parse(bodyText);
		} catch {
			// Keep as text if JSON parsing fails (e.g. truncated)
		}
	}

	const envelope: ResponseEnvelope = {
		status: response.status,
		contentType,
		headers: filterHeaders(response.headers),
		body: parsedBody,
		truncated,
	};

	if (authNote && response.status === 401) {
		envelope.authNote = authNote;
	}

	return envelope;
}
