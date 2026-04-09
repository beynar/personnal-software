import { createFileRoute } from "@tanstack/react-router";
import {
	handleOAuthAuthorizationServer,
	handleOAuthOptions,
	handleOAuthProtectedResource,
} from "~/lib/mcp-oauth";

function handleWellKnown(request: Request): Response {
	const url = new URL(request.url);
	if (
		url.pathname === "/.well-known/oauth-authorization-server" ||
		url.pathname === "/.well-known/oauth-authorization-server/api/auth"
	) {
		if (request.method === "OPTIONS") {
			return handleOAuthOptions();
		}
		return handleOAuthAuthorizationServer(url.origin);
	}

	if (
		url.pathname === "/.well-known/oauth-protected-resource" ||
		url.pathname === "/.well-known/oauth-protected-resource/api/mcp"
	) {
		if (request.method === "OPTIONS") {
			return handleOAuthOptions();
		}
		return handleOAuthProtectedResource(url.origin);
	}

	return new Response("Not Found", { status: 404 });
}

export const Route = createFileRoute("/$")({
	server: {
		handlers: {
			GET: ({ request }) => handleWellKnown(request),
			OPTIONS: ({ request }) => handleWellKnown(request),
		},
	},
});
