import { createFileRoute } from "@tanstack/react-router";
import { app } from "~/lib/api";

const handler = (request: Request) => app.fetch(request);

export const Route = createFileRoute("/api/v1/$")({
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
