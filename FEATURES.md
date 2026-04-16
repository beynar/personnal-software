# Feature Implementation Guide

This file defines where feature code belongs in this repository.

If you are adding a new feature, do not improvise the structure. Follow these placement rules.

## Core rule

- Put UI concerns in `app/`.
- Put the canonical machine contract in the oRPC layer under `app/lib/orpc/`.
- Put persistent data and business logic in `convex/`.
- Keep route files thin. A route should compose UI and call existing APIs, not become the API.

## Routes

This repo uses TanStack Router flat file routing.

- `app/routes/index.tsx` is the public auth page.
- `app/routes/dashboard.tsx` is the authenticated layout route.
- `app/routes/dashboard.index.tsx` is the default child page for `/dashboard`.
- `app/routes/dashboard.*.tsx` are nested dashboard pages.
- `app/routes/examples.*.tsx` are implementation examples, not primary user navigation.

When adding a page:

- Add authenticated product pages under `app/routes/dashboard.*.tsx` unless the page must live outside the dashboard shell.
- Add public pages as top-level route files in `app/routes/`.
- If the page should keep the sidebar visible during navigation, make it a child of `dashboard.tsx`.

## Route responsibilities

Use route files for:

- `createFileRoute(...)`
- page-level layout
- route-local UI state
- calling the default oRPC client from loaders
- calling Convex hooks from the client when reactivity is required
- redirecting between public and authenticated areas

Do not use route files for:

- direct database access
- core validation rules
- ownership checks
- reusable mutations or query logic

Those belong in `convex/`.

## Loaders

Use TanStack route loaders for page-initial server data.

- Prefer the default oRPC client from router context for loader data.
- Prefer Convex `useQuery` only when the UI needs live reactive updates after render.
- Do not duplicate backend logic inside a loader.
- Do not put auth authorization logic only in a loader. Server-side ownership rules still belong behind the oRPC layer and in Convex functions.
- Do not self-fetch `/api/v1/*` from a loader. Use `context.getOrpc()` so SSR stays in-process.

## Decision tree

Use this rule set before adding code:

- user or agent capability: define it in the oRPC contract/router layer
- initial page render data: call that capability from the route loader via `context.getOrpc()`
- live reactive UI after first paint: use Convex hooks in the client
- local presentation state: keep it in React state
- small server-only helper that is not a product capability: use `createServerFn`

## Machine contract

- Define user and agent capabilities in the oRPC contract/router layer first.
- `/api/v1/*` is generated from that layer and is the public OpenAPI surface.
- MCP route discovery and execution are driven by the generated OpenAPI spec.
- Do not add hand-written REST handlers for product capabilities in route files.
- If a capability should be available to an LLM or external client, it belongs in oRPC, not only in the page loader.

## Golden path reference

Use the existing starter flow as the reference implementation instead of inventing a new shape:

- capability contract: `app/lib/orpc/contract.ts`
- capability implementation: `app/lib/orpc/router.ts`
- generated public API surface: `app/lib/api.ts`
- route loader using the default oRPC client: `app/routes/dashboard.index.tsx`
- optional reactive client follow-up: dashboard shell and profile routes that use Convex hooks

That route is intentionally documented as the canonical SSR path:

1. define or extend a capability in oRPC
2. keep backend rules in Convex
3. call the capability from the page loader with `context.getOrpc()`
4. render the first payload from loader data
5. add client-side Convex hooks only if the screen truly needs live updates

## Queries, mutations, and actions

Create feature-specific files in `convex/`. Group by domain.

Examples:

- `convex/projects.ts`
- `convex/messages.ts`
- `convex/billing.ts`

Use:

- `query` for reads
- `mutation` for writes
- `action` only for external I/O, third-party APIs, or Node-only work
- `internalQuery`, `internalMutation`, `internalAction` for private helpers that should not be public API

For new features, prefer imports from `convex/_generated/server` and function references from `convex/_generated/api`.

Do not copy the generic fallback pattern from starter example files unless bootstrap constraints truly require it. Once the project is bootstrapped, generated Convex types are the default.

## Auth checks

Auth checks belong in two places:

- route-level UX guard in `app/routes/`
- real authorization in `convex/`

Route-level guard patterns:

- public page redirects authenticated users away when appropriate
- authenticated layout redirects unauthenticated users to `/`

Convex authorization patterns:

- derive identity server-side
- never accept `userId` from the client for auth decisions
- check ownership inside the query or mutation that reads or writes protected data

If a feature is user-owned, every write path must verify ownership in Convex before mutating data.

## `createServerFn`

`createServerFn` is for narrow app-internal server helpers, not the canonical product API surface.

Good fits:

- auth/session glue
- request-scoped helpers
- small server-only transforms or guards

Bad fits:

- user-facing product capabilities
- machine-readable API surface
- feature mutations that should also be available to MCP or external clients

## UI decomposition

Place reusable presentational components under:

- `app/components/` for feature components
- `app/components/ui/` for design-system primitives only

Do not put feature-specific components into `app/components/ui/`.

Recommended split:

- route file: page composition
- feature component: specific screen section or flow
- ui component: generic primitive reused across features

## Navigation

User-facing dashboard navigation lives in `app/routes/dashboard.tsx`.

- Do not add example or debug routes to the main user nav unless they are meant for users.
- Keep dashboard pages nested so the sidebar stays mounted.

## Verification after each feature

After adding or changing a feature, run:

```bash
npm run lint
npm run typecheck
npm run build
```

If the feature changes auth, also verify:

1. unauthenticated access
2. authenticated access
3. redirect behavior
4. ownership enforcement in Convex

## Anti-patterns

- no self-fetching the app's own `/api/v1/*` routes from SSR loaders
- no business logic or ownership checks in route files
- no second machine contract outside `app/lib/orpc/`
- no defaulting to `createServerFn` when the feature is a real user or agent capability
