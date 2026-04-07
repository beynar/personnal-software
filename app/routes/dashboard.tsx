import { useAuthActions } from "@convex-dev/auth/react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
	AuthLoading,
	Authenticated,
	Unauthenticated,
	useQuery,
} from "convex/react";
import { type FunctionReference, anyApi } from "convex/server";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";

const viewerQuery: FunctionReference<"query"> = anyApi.users.viewer;

export const Route = createFileRoute("/dashboard")({
	component: DashboardPage,
});

function DashboardPage() {
	return (
		<>
			<AuthLoading>
				<AuthPendingMessage />
			</AuthLoading>
			<Authenticated>
				<DashboardLayout />
			</Authenticated>
			<Unauthenticated>
				<RedirectToLogin />
			</Unauthenticated>
		</>
	);
}

function AuthPendingMessage() {
	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<p className="text-sm text-muted-foreground">Checking your session…</p>
		</div>
	);
}

function RedirectToLogin() {
	const navigate = useNavigate();
	useEffect(() => {
		navigate({ to: "/" });
	}, [navigate]);

	return (
		<div className="flex min-h-screen items-center justify-center px-4">
			<p className="text-sm text-muted-foreground">
				Redirecting to sign in…{" "}
				<a href="/" className="underline">
					Continue manually
				</a>
			</p>
		</div>
	);
}

function DashboardLayout() {
	const { signOut } = useAuthActions();
	const user = useQuery(viewerQuery);
	const navigate = useNavigate();

	async function handleSignOut() {
		await signOut();
		navigate({ to: "/" });
	}

	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
					<h1 className="text-lg font-semibold">Bubbly Dragon</h1>
					<div className="flex items-center gap-4">
						{user?.email && (
							<span className="text-sm text-muted-foreground">
								{user.email}
							</span>
						)}
						<Button variant="outline" size="sm" onClick={handleSignOut}>
							Sign Out
						</Button>
					</div>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-8">
				<h2 className="text-2xl font-bold">Welcome back</h2>
				{user?.email && (
					<p className="mt-2 text-muted-foreground">
						Signed in as {user.email}
					</p>
				)}
			</main>
		</div>
	);
}
