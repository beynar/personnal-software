import { createFileRoute } from "@tanstack/react-router";
import { PublicAuthCard } from "~/components/auth/public-auth-card";

export const Route = createFileRoute("/mcp/login")({
	component: McpLoginPage,
});

function McpLoginPage() {
	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<PublicAuthCard />
		</div>
	);
}
