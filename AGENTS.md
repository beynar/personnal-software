<!-- convex-ai-start -->
# Agent Guide

Read this first.

## Read Order

1. `AGENTS.md`
2. `BOOTSTRAP.md` before setup, auth config, or deploy
3. `FEATURES.md` before adding routes or Convex APIs
4. `ROUTING_AND_DATA_FLOW.md` before adding a new user or agent capability
5. `DATA_MODEL.md` before changing schema or indexes
6. `UI_SYSTEM.md` before adding or composing UI
7. `convex/_generated/ai/guidelines.md` before writing Convex code

## Stack

- React 19
- TanStack Start + TanStack Router
- oRPC + OpenAPI
- Convex
- `@convex-dev/better-auth`
- Tailwind CSS v4
- shadcn + Dice UI primitives in `app/components/ui/`
- Sonner for notifications
- Cloudflare Workers via Wrangler
- Biome + TypeScript

## Repo Truths

- local app host: `http://localhost:8888`
- `npm run dev` starts the app
- `VITE_CONVEX_URL` must be an absolute URL
- root Convex wiring lives in `app/routes/__root.tsx`
- auth domain wiring lives in `convex/auth.config.ts`
- deploy with `npm run deploy`
- Worker secrets go through Wrangler CLI, not `wrangler.toml`

If setup or deploy is unclear, read `BOOTSTRAP.md`. Do not guess.

## Where Code Goes

- `app/routes/`: route files
- `app/routes/dashboard.*.tsx`: authenticated product pages
- `app/components/`: feature components
- `app/components/ui/`: shared primitives only
- `convex/`: queries, mutations, actions, schema
- `app/worker/`: Cloudflare-specific worker code

## Cloudflare Patterns

This repo can host Cloudflare-specific examples under `app/worker/examples/`.

When the user asks for Cloudflare infrastructure examples:

- put Worker examples under `app/worker/examples/`
- keep them isolated from user-facing product code
- document them in `CLOUDFLARE_EXAMPLES.md`
- do not mix example infrastructure code into the main app routes unless the feature actually uses it

Examples that are worth keeping in this template:

- scheduled handlers
- Durable Objects
- sandbox / isolated execution patterns
- browser rendering / remote browser automation patterns

Rules:

- examples must be clearly labeled as examples
- examples must say what bindings or Wrangler config they need
- examples must say whether they are production-ready or just a starting point
- before implementing one, read `.agents/skills/cloudflare/SKILL.md` and verify the current product docs
- if a feature needs one of these patterns for real, move from `examples/` into actual app code deliberately

## Convex Rules

- read `convex/_generated/ai/guidelines.md` first
- use `query` for reads
- use `mutation` for writes
- use `action` only for external I/O or Node-only work
- derive identity server-side
- never trust client `userId` for auth
- prefer indexes over `filter`
- paginate or bound lists
- keep Convex code grouped by domain

## API Rules

- user or agent capabilities belong in the oRPC contract/router layer first
- `/api/v1/*` is generated from that oRPC layer and is the public machine surface
- MCP route discovery and execution derive from the generated OpenAPI spec
- page-initial server data should prefer TanStack loaders calling the default oRPC client from router context
- use Convex hooks from the client only when the UI truly needs live reactive updates after first paint
- use `createServerFn` only for small app-internal server helpers, not as the main product capability layer
- browser session auth may be used by same-origin app calls, but external machine access still needs API-key or MCP auth
- keep route files thin; do not hand-build new REST handlers in route files
- keep business rules and ownership checks in Convex or dedicated backend modules behind oRPC procedures

## Architecture Decision Tree

- user or agent capability: define it in `app/lib/orpc/contract.ts` and implement it in `app/lib/orpc/router.ts`
- initial page render data: call that capability from a TanStack route loader via `context.getOrpc()`
- live reactive UI after first paint: use Convex hooks in the client
- local presentation state: keep it in React state inside the route or component
- small server-only helper that is not a product capability: use `createServerFn`

If a user or LLM should be able to ask for it directly, it belongs in the oRPC layer first.

## UI Rules

- use existing primitives first
- use tokens from `app/app.css`
- keep user-facing pages under the dashboard layout when the sidebar should persist
- when a dashboard page needs to control shell-owned chrome, declare `staticData.dashboardHeader` in the route definition instead of hard-coding page title/description/header blocks inside the page body
- notifications use Sonner only
- make new components work in light and dark mode
- render new primitives on `/dashboard/design-system`
- do not show internal docs like `AGENTS.md` in user-facing UI

## Text Style

Write user-facing copy like product UI, not marketing.

Good:

- "Create project"
- "Upload failed"
- "Retry deployment"

Bad:

- "Let’s unlock your workflow"
- "Everything is ready for greatness"
- "Consult AGENTS.md before continuing"

## Feature Workflow

1. decide whether the feature is a real user or agent capability
2. confirm the data model and backend ownership rules
3. define or extend the oRPC contract and handler for that capability
4. implement or update the Convex logic behind it
5. expose initial page data through a TanStack loader using `context.getOrpc()`
6. add Convex hooks only if the page needs live reactive updates after render
7. compose the route and UI from existing primitives
8. verify auth and ownership
9. run checks

## New Feature Checklist

- define the capability in the oRPC layer when it represents real product behavior
- keep business logic and ownership checks in Convex or backend modules behind oRPC
- use a route loader plus `context.getOrpc()` for first render data
- use Convex hooks only for reactive follow-up data
- keep route files focused on composition, not backend rules
- keep external machine access flowing through the generated OpenAPI surface
- check `FEATURES.md` and `ROUTING_AND_DATA_FLOW.md` before inventing a new pattern

## Checks

Always run:

```bash
npm run lint
npm run typecheck
npm run build
```

Also verify the relevant runtime path:

- auth flows
- dashboard navigation
- schema ownership rules
- design system page for UI additions

## Do Not

- do not invent a second UI system
- do not invent a second sidebar
- do not duplicate Convex logic in routes
- do not self-fetch `/api/v1/*` from loaders when `context.getOrpc()` is available
- do not put business logic or ownership rules in route files
- do not define a duplicate machine contract outside the oRPC layer
- do not treat `createServerFn` as the default product API
- do not guess env names, auth domains, or deploy commands
- do not add user-facing copy that exposes internal LLM instructions

Convex agent skills can be installed with:

```bash
npx convex ai-files install
```
<!-- convex-ai-end -->
