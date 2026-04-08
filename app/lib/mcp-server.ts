/**
 * MCP (Model Context Protocol) server implementation.
 *
 * Implements JSON-RPC 2.0 dispatch for the MCP protocol without the
 * @modelcontextprotocol/sdk dependency, which requires Node.js HTTP
 * primitives incompatible with Cloudflare Workers.
 *
 * Tools are registered via `registerTool()` — no hard-coded branches.
 */

import { executeApiRequest } from "~/lib/mcp-openapi-tools";
import { searchCatalog } from "~/lib/openapi-catalog";

const SERVER_INFO = {
	name: "bubbly-dragon",
	version: "1.0.0",
};

const PROTOCOL_VERSION = "2025-03-26";

const CAPABILITIES = {
	tools: {},
};

type McpUser = {
	id: string;
	email: string;
	name: string;
	createdAt: string;
};

export type McpSession = {
	user: McpUser;
	session: {
		id: string;
		expiresAt: string;
	};
	/** Original credential material for downstream forwarding. */
	credential:
		| { type: "bearer"; token: string }
		| { type: "api-key"; apiKey: string };
};

type JsonRpcRequest = {
	jsonrpc: "2.0";
	method: string;
	params?: Record<string, unknown>;
	id?: string | number | null;
};

type ToolResult = {
	content: { type: string; text: string }[];
};

type ToolDefinition = {
	name: string;
	description: string;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
};

type ToolHandler = (
	params: Record<string, unknown>,
	session: McpSession,
) => ToolResult | Promise<ToolResult>;

type RegisteredTool = {
	definition: ToolDefinition;
	handler: ToolHandler;
};

/** Tool registry — keyed by tool name. */
const toolRegistry = new Map<string, RegisteredTool>();

/** Register an MCP tool with its definition and handler. */
function registerTool(definition: ToolDefinition, handler: ToolHandler): void {
	toolRegistry.set(definition.name, { definition, handler });
}

// ---- Built-in tools ----

registerTool(
	{
		name: "get-profile",
		description:
			"Returns the authenticated user's profile information including email, name, and account creation date.",
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
	(_params, session) => ({
		content: [
			{
				type: "text",
				text: JSON.stringify(
					{
						id: session.user.id,
						email: session.user.email,
						name: session.user.name,
						createdAt: session.user.createdAt,
					},
					null,
					2,
				),
			},
		],
	}),
);

registerTool(
	{
		name: "search-routes",
		description:
			"Search the API route catalog by keyword. Returns matching routes with method, path, summary, and schema information.",
		inputSchema: {
			type: "object",
			properties: {
				query: {
					type: "string",
					description:
						"Keyword to search for in route paths, summaries, descriptions, and tags.",
				},
			},
			required: ["query"],
		},
	},
	(params) => {
		const query = (params.query as string) ?? "";
		const results = searchCatalog(query);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(results, null, 2),
				},
			],
		};
	},
);

registerTool(
	{
		name: "execute",
		description:
			"Execute an API request against /api/v1 routes. The host forwards your authenticated credential — sandboxed code never handles secrets directly. Returns a response envelope with status, content type, headers, parsed body, and truncation flag.",
		inputSchema: {
			type: "object",
			properties: {
				method: {
					type: "string",
					description:
						'HTTP method (GET, POST, PUT, PATCH, DELETE). Defaults to "GET".',
				},
				path: {
					type: "string",
					description:
						'API path, e.g. "/test" or "/api/v1/test". Paths without the /api/v1 prefix are auto-prefixed.',
				},
				headers: {
					type: "object",
					description:
						"Optional request headers. Auth headers are injected automatically.",
				},
				body: {
					description:
						"Optional request body (object or string). Automatically JSON-serialized for non-GET requests.",
				},
			},
			required: ["path"],
		},
	},
	async (params, session) => {
		const envelope = await executeApiRequest(
			{
				method: params.method as string | undefined,
				path: params.path as string | undefined,
				headers: params.headers as Record<string, string> | undefined,
				body: params.body,
			},
			session,
		);
		return {
			content: [
				{
					type: "text",
					text: JSON.stringify(envelope, null, 2),
				},
			],
		};
	},
);

// ---- JSON-RPC helpers ----

function jsonRpcError(
	id: string | number | null,
	code: number,
	message: string,
) {
	return { jsonrpc: "2.0" as const, error: { code, message }, id };
}

function jsonRpcResult(id: string | number | null, result: unknown) {
	return { jsonrpc: "2.0" as const, result, id };
}

/**
 * Dispatches a single JSON-RPC request and returns the response object,
 * or null for notifications (requests without an id).
 */
export async function handleMcpRequest(
	request: JsonRpcRequest,
	session: McpSession,
): Promise<object | null> {
	const isNotification = request.id === undefined || request.id === null;

	switch (request.method) {
		// Notifications — no response
		case "notifications/initialized":
		case "notifications/cancelled":
			return null;

		case "initialize":
			return jsonRpcResult(request.id ?? null, {
				protocolVersion: PROTOCOL_VERSION,
				capabilities: CAPABILITIES,
				serverInfo: SERVER_INFO,
			});

		case "ping":
			return jsonRpcResult(request.id ?? null, {});

		case "tools/list": {
			const tools = [...toolRegistry.values()].map((t) => t.definition);
			return jsonRpcResult(request.id ?? null, { tools });
		}

		case "tools/call": {
			const toolName = request.params?.name as string | undefined;
			const tool = toolName ? toolRegistry.get(toolName) : undefined;
			if (tool) {
				const args =
					(request.params?.arguments as Record<string, unknown>) ?? {};
				const result = await tool.handler(args, session);
				return jsonRpcResult(request.id ?? null, result);
			}
			return jsonRpcError(
				request.id ?? null,
				-32602,
				`Unknown tool: ${toolName}`,
			);
		}

		default:
			if (isNotification) return null;
			return jsonRpcError(
				request.id ?? null,
				-32601,
				`Method not found: ${request.method}`,
			);
	}
}
