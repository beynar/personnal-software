import { handler } from "~/lib/auth-server";
import type { McpSession } from "~/lib/mcp";

const AUTH_BASE_URL = "http://local/api/auth";

export const auth = {
	api: {
		async getMcpSession({
			headers,
		}: {
			headers: Headers;
		}): Promise<McpSession | null> {
			const response = await handler(
				new Request(`${AUTH_BASE_URL}/mcp/get-session`, {
					method: "GET",
					headers,
				}),
			);

			if (!response.ok) {
				throw new Error(
					`Better Auth MCP session lookup failed with status ${response.status}`,
				);
			}

			return (await response.json()) as McpSession | null;
		},
	},
};
