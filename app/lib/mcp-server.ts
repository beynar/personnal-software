/**
 * MCP (Model Context Protocol) server implementation.
 *
 * Implements JSON-RPC 2.0 dispatch for the MCP protocol without the
 * @modelcontextprotocol/sdk dependency, which requires Node.js HTTP
 * primitives incompatible with Cloudflare Workers.
 */

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
};

type JsonRpcRequest = {
	jsonrpc: "2.0";
	method: string;
	params?: Record<string, unknown>;
	id?: string | number | null;
};

const TOOLS = [
	{
		name: "get-profile",
		description:
			"Returns the authenticated user's profile information including email, name, and account creation date.",
		inputSchema: {
			type: "object" as const,
			properties: {},
		},
	},
];

function handleGetProfile(session: McpSession) {
	return {
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
	};
}

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
export function handleMcpRequest(
	request: JsonRpcRequest,
	session: McpSession,
): object | null {
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

		case "tools/list":
			return jsonRpcResult(request.id ?? null, { tools: TOOLS });

		case "tools/call": {
			const toolName = request.params?.name as string | undefined;
			if (toolName === "get-profile") {
				return jsonRpcResult(request.id ?? null, handleGetProfile(session));
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
