// Real-time Data Example — demonstrates Convex reactive subscriptions.
//
// How Convex real-time works on the client:
// 1. `useQuery(ref, args)` subscribes to a Convex query. The hook returns the
//    current result and automatically re-renders when the server-side data changes.
// 2. `useMutation(ref)` returns a function that calls a Convex mutation. After
//    the mutation commits on the server, any queries that read the affected data
//    are re-evaluated and pushed to all subscribed clients.
// 3. For optimistic updates, pass an `optimisticUpdate` option to `useMutation`.
//    The update function receives a local store and applies predicted changes
//    immediately, which are rolled back if the server result differs.
//
// Open this page in two browser tabs and click the buttons — both tabs update
// instantly without polling or manual refetching.

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import type { OptimisticLocalStore } from "convex/browser";
import {
	AuthLoading,
	Authenticated,
	Unauthenticated,
	useMutation,
	useQuery,
} from "convex/react";
import { type FunctionReference, anyApi } from "convex/server";
import { useEffect } from "react";
import { Button } from "~/components/ui/button";

// --- Convex function references (avoids needing _generated API) ---
const getCounterQuery: FunctionReference<
	"query",
	"public",
	{ name: string },
	number
> = anyApi.realtime.getCounter;
const incrementCounterMutation: FunctionReference<"mutation"> =
	anyApi.realtime.incrementCounter;
const resetCounterMutation: FunctionReference<"mutation"> =
	anyApi.realtime.resetCounter;

export const Route = createFileRoute("/examples/realtime")({
	component: RealtimePage,
});

function RealtimePage() {
	return (
		<>
			<AuthLoading>
				<AuthPendingMessage />
			</AuthLoading>
			<Authenticated>
				<RealtimeLayout />
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

// --- Main layout ---
function RealtimeLayout() {
	const navigate = useNavigate();

	return (
		<div className="min-h-screen">
			<header className="border-b">
				<div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
					<h1 className="text-lg font-semibold">Real-time Data Example</h1>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => navigate({ to: "/dashboard" })}
					>
						Dashboard
					</Button>
				</div>
			</header>
			<main className="mx-auto max-w-4xl px-4 py-8">
				{/* Explanation banner */}
				<div className="mb-8 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-100">
					<p className="font-medium mb-1">How this works</p>
					<p>
						Open this page in <strong>two browser tabs</strong> and click the
						buttons. Changes made in one tab appear instantly in the other — no
						polling, no manual refresh. Convex queries are reactive: when a
						mutation changes data, every subscribed client receives the updated
						result automatically.
					</p>
				</div>

				<div className="grid gap-8 sm:grid-cols-2">
					<SharedCounter name="global" label="Global Counter" />
					<SharedCounter name="secondary" label="Secondary Counter" />
				</div>
			</main>
		</div>
	);
}

// --- Shared counter component ---
// Each counter subscribes to the same Convex query with a different `name` arg.
// Convex tracks subscriptions per (query, args) pair, so each counter gets
// independent real-time updates.
function SharedCounter({ name, label }: { name: string; label: string }) {
	// `useQuery` subscribes to the Convex query. When any client calls
	// `incrementCounter` or `resetCounter` for this counter name, Convex
	// re-runs the query and pushes the new value here — no polling needed.
	const count = useQuery(getCounterQuery, { name });

	// --- Optimistic updates ---
	// Pass an `optimisticUpdate` function to `useMutation` so the UI updates
	// immediately without waiting for the server round-trip. If the server
	// result differs, Convex automatically rolls back the optimistic change
	// and applies the authoritative value.
	const increment = useMutation(incrementCounterMutation).withOptimisticUpdate(
		(store: OptimisticLocalStore, args: { name: string; amount: number }) => {
			const currentValue = store.getQuery(getCounterQuery, { name: args.name });
			if (currentValue !== undefined) {
				store.setQuery(
					getCounterQuery,
					{ name: args.name },
					currentValue + args.amount,
				);
			}
		},
	);

	const reset = useMutation(resetCounterMutation).withOptimisticUpdate(
		(store: OptimisticLocalStore, args: { name: string }) => {
			store.setQuery(getCounterQuery, { name: args.name }, 0);
		},
	);

	// Query is loading (first render before subscription is established)
	const isLoading = count === undefined;

	return (
		<div className="rounded-lg border p-6">
			<h2 className="mb-1 text-lg font-semibold">{label}</h2>
			<p className="mb-4 text-xs text-muted-foreground">
				Counter name:{" "}
				<code className="rounded bg-muted px-1 py-0.5">{name}</code>
			</p>

			{/* Counter display */}
			<div className="mb-6 flex items-center justify-center">
				<span className="tabular-nums text-6xl font-bold tracking-tight">
					{isLoading ? "—" : count}
				</span>
			</div>

			{/* Controls */}
			<div className="flex items-center justify-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => increment({ name, amount: -1 })}
					disabled={isLoading}
				>
					− 1
				</Button>
				<Button
					size="sm"
					onClick={() => increment({ name, amount: 1 })}
					disabled={isLoading}
				>
					+ 1
				</Button>
				<Button
					variant="outline"
					size="sm"
					onClick={() => increment({ name, amount: 10 })}
					disabled={isLoading}
				>
					+ 10
				</Button>
				<Button
					variant="ghost"
					size="sm"
					onClick={() => reset({ name })}
					disabled={isLoading}
				>
					Reset
				</Button>
			</div>

			{/* Real-time indicator */}
			<div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
				<span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
				Live — synced across all tabs
			</div>
		</div>
	);
}
