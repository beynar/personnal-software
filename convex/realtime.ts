// Convex real-time subscription pattern — shared counter example.
//
// How Convex real-time works:
// 1. Queries are "reactive" — when data they read changes, all subscribed
//    clients automatically receive the updated result.
// 2. Mutations write data. After a mutation commits, Convex re-runs any
//    queries that read the affected data and pushes new results to clients.
// 3. On the client, `useQuery(ref)` subscribes to a query. The component
//    re-renders whenever the query result changes — no polling, no websocket
//    setup, no cache invalidation needed.
//
// This file defines a shared counter that any number of browser tabs can
// increment/decrement simultaneously. Changes appear instantly in all tabs.
//
// Note: We use `queryGeneric`/`mutationGeneric` because the Convex `_generated`
// directory doesn't exist without running `npx convex dev`. The runtime behavior
// is identical; only TypeScript loses schema-specific types.

import type { GenericMutationCtx, GenericQueryCtx } from "convex/server";
import { mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";

type Ctx = GenericQueryCtx<Record<string, never>>;
type MutCtx = GenericMutationCtx<Record<string, never>>;

// biome-ignore lint/suspicious/noExplicitAny: Convex generic ctx methods lose type info without _generated types
type AnyFn = (...args: any[]) => any;

// ---------------------------------------------------------------------------
// Query: get the current counter value.
// Convex will re-run this whenever the counter document changes, pushing the
// new value to every subscribed client via `useQuery`.
// ---------------------------------------------------------------------------
export const getCounter = queryGeneric({
	args: { name: v.string() },
	handler: async (ctx: Ctx, args: { name: string }) => {
		const row = await (ctx.db.query as AnyFn)("counters")
			.withIndex("by_name", (q: { eq: AnyFn }) => q.eq("name", args.name))
			.unique();
		return (row as { value: number } | null)?.value ?? 0;
	},
});

// ---------------------------------------------------------------------------
// Mutation: increment (or decrement) the counter by a given amount.
// After this mutation commits, the `getCounter` query is automatically
// re-evaluated for all subscribers — that's the Convex reactivity model.
// ---------------------------------------------------------------------------
export const incrementCounter = mutationGeneric({
	args: { name: v.string(), amount: v.number() },
	handler: async (ctx: MutCtx, args: { name: string; amount: number }) => {
		const existing = await (ctx.db.query as AnyFn)("counters")
			.withIndex("by_name", (q: { eq: AnyFn }) => q.eq("name", args.name))
			.unique();

		if (existing) {
			// Update the existing counter document
			await (ctx.db.patch as AnyFn)((existing as { _id: string })._id, {
				value: (existing as { value: number }).value + args.amount,
			});
		} else {
			// First increment — create the counter document
			await (ctx.db.insert as AnyFn)("counters", {
				name: args.name,
				value: args.amount,
			});
		}
	},
});

// ---------------------------------------------------------------------------
// Mutation: reset the counter to zero.
// ---------------------------------------------------------------------------
export const resetCounter = mutationGeneric({
	args: { name: v.string() },
	handler: async (ctx: MutCtx, args: { name: string }) => {
		const existing = await (ctx.db.query as AnyFn)("counters")
			.withIndex("by_name", (q: { eq: AnyFn }) => q.eq("name", args.name))
			.unique();

		if (existing) {
			await (ctx.db.patch as AnyFn)((existing as { _id: string })._id, {
				value: 0,
			});
		}
	},
});
