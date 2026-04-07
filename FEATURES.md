# Feature Implementation Guide

This file defines where feature code belongs in this repository.

If you are adding a new feature, do not improvise the structure. Follow these placement rules.

## Core rule

- Put UI concerns in `app/`.
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
- calling Convex hooks from the client
- redirecting between public and authenticated areas

Do not use route files for:

- direct database access
- core validation rules
- ownership checks
- reusable mutations or query logic

Those belong in `convex/`.

## Loaders

Use TanStack route loaders sparingly.

- Prefer Convex `useQuery` for reactive authenticated app data.
- Use a loader only for route-level data that must exist before render and does not benefit from Convex reactivity.
- Do not duplicate Convex query logic inside a loader.
- Do not put auth authorization logic only in a loader. Server-side ownership rules still belong in Convex functions.

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
