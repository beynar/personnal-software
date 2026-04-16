# Routing And Data Flow

This file is the short architecture note for adding features without drifting into a second pattern.

## Core split

- `app/routes/` composes pages and loaders
- `app/lib/orpc/` defines and implements user or agent capabilities
- `convex/` owns persistent data, business rules, and ownership checks
- `/api/v1/*` and MCP are generated from the oRPC layer

If the feature should be usable by the UI, an LLM, or an external client, define the capability in oRPC first.

## Decision tree

- real user or agent capability: oRPC contract and router
- initial page render data: TanStack route loader calling `context.getOrpc()`
- live updates after first paint: Convex hooks in the client
- local presentation mechanics: React state
- small server-only helper: `createServerFn`

## Golden path

Use the dashboard overview route as the starter reference:

- capability contract: [app/lib/orpc/contract.ts](/Users/arnaud/code/personnal-software/app/lib/orpc/contract.ts)
- capability implementation: [app/lib/orpc/router.ts](/Users/arnaud/code/personnal-software/app/lib/orpc/router.ts)
- OpenAPI surface: [app/lib/api.ts](/Users/arnaud/code/personnal-software/app/lib/api.ts)
- route loader: [app/routes/dashboard.index.tsx](/Users/arnaud/code/personnal-software/app/routes/dashboard.index.tsx)

That path demonstrates:

1. define a capability in oRPC
2. keep backend rules behind that boundary
3. load initial page data through the route loader with `context.getOrpc()`
4. render from loader data on first paint
5. add Convex hooks later only if the screen needs live reactivity

## New feature checklist

- define or extend the oRPC capability first
- keep ownership checks and persistent mutations in Convex
- call the capability from the route loader for first paint
- keep route files focused on composition and local state
- add client-side Convex hooks only when reactivity is actually needed
- verify auth, ownership, and machine access

## Do not do this

- do not self-fetch `/api/v1/*` from SSR loaders
- do not put business logic or ownership checks in route files
- do not define a second machine contract outside `app/lib/orpc/`
- do not use `createServerFn` as the default feature API
