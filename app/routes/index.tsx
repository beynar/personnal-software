import { createFileRoute, redirect } from "@tanstack/react-router";
import { PublicAuthCard } from "~/components/auth/public-auth-card";
import { checkBetterAuthSession } from "~/lib/auth.functions";

export const Route = createFileRoute("/")({
	beforeLoad: async () => {
		const isAuthenticated = await checkBetterAuthSession();
		if (isAuthenticated) {
			throw redirect({ to: "/dashboard" });
		}
	},
	component: HomePage,
});

function HomePage() {
	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<PublicAuthCard />
		</div>
	);
}
