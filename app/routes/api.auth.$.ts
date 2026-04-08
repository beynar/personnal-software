import { createFileRoute } from "@tanstack/react-router";
import { handler } from "~/lib/auth-server";

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => handler(request),
			POST: ({ request }) => handler(request),
			PUT: ({ request }) => handler(request),
			PATCH: ({ request }) => handler(request),
			DELETE: ({ request }) => handler(request),
			OPTIONS: ({ request }) => handler(request),
		},
	},
});
