<!-- convex-ai-start -->
# Agent Guide

Read this before changing the project. If another document disagrees with this file, stop and verify rather than guessing.

## Read Order

1. `AGENTS.md`
2. `BOOTSTRAP.md` before setup, auth config, or deploy
3. `FEATURES.md` before adding routes or Convex APIs
4. `ROUTING_AND_DATA_FLOW.md` before adding a user or agent capability
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

- Local app host: `http://localhost:8888`
- Start dev server: `npm run dev`
- Deploy: `npm run deploy`
- `VITE_CONVEX_URL` must be an absolute URL
- Root Convex wiring lives in `app/routes/__root.tsx`
- Auth domain wiring lives in `convex/auth.config.ts`
- Worker secrets go through Wrangler CLI, not `wrangler.toml`
- If setup or deploy is unclear, read `BOOTSTRAP.md`; do not guess env names, auth domains, or deploy commands

## Project Map

- `app/routes/`: route files
- `app/routes/dashboard.*.tsx`: authenticated product pages
- `app/components/`: feature components
- `app/components/ui/`: shared primitives only
- `convex/`: queries, mutations, actions, schema
- `app/worker/`: Cloudflare-specific worker code

## Architecture

### Capability Surface

- User or agent capabilities belong in the oRPC contract/router layer first.
- Define capabilities in `app/lib/orpc/contract.ts`.
- Implement capabilities in `app/lib/orpc/router.ts`.
- `/api/v1/*` is generated from the oRPC layer and is the public machine surface.
- MCP route discovery and execution derive from the generated OpenAPI spec.
- Do not hand-build new REST handlers in route files.
- Do not define a duplicate machine contract outside the oRPC layer.

### Data Flow

- New pages should use SSR-friendly TanStack loaders as the primary data-fetching path.
- Initial page render data should come from a TanStack route loader using `context.getOrpc()`.
- Do not self-fetch `/api/v1/*` from loaders when `context.getOrpc()` is available.
- Use Convex hooks from the client only when the UI needs live reactive updates after first paint.
- Use `createServerFn` only for small app-internal server helpers, not as the main product capability layer.
- Keep route files focused on composition, not backend rules.
- Keep business rules and ownership checks in Convex or backend modules behind oRPC procedures.

### Auth And Ownership

- Browser session auth may be used by same-origin app calls.
- External machine access still needs API-key or MCP auth.
- Derive identity server-side.
- Never trust client `userId` for auth.
- Verify auth and ownership on every protected capability.

## Convex

- Read `convex/_generated/ai/guidelines.md` before writing Convex code.
- Use `query` for reads.
- Use `mutation` for writes.
- Use `action` only for external I/O or Node-only work.
- Prefer indexes over `filter`.
- Paginate or bound lists.
- Keep Convex code grouped by domain.
- Do not duplicate Convex logic in routes.

## Pages And UI

### Dashboard Routes

- Keep user-facing pages under the dashboard layout when the sidebar should persist.
- Dashboard pages that need dynamic shell chrome must return `dashboardHeader` from the route loader.
- `dashboardHeader` should include the page `title`, optional `description`, and optional `backHref`.
- Use `staticData.dashboardHeader` only for literal static titles/descriptions.
- Do not hard-code duplicate title, description, or back-button blocks inside the page body when the shell owns that chrome.

### Loading States

- Every new route should define a `pendingComponent`.
- The `pendingComponent` should render skeleton UI that matches the final page structure closely enough to avoid layout shift.
- Use existing skeleton primitives before creating new loading components.

### UI System

- Use existing primitives first.
- Use tokens from `app/app.css`.
- New primitives belong in `app/components/ui/`.
- Render new primitives on `/dashboard/design-system`.
- Make new components work in light and dark mode.
- Notifications use Sonner only.
- Do not invent a second UI system.
- Do not invent a second sidebar.
- Do not show internal docs like `AGENTS.md` in user-facing UI.

## Cloudflare Examples

This repo can host Cloudflare-specific examples under `app/worker/examples/`.

Use examples for:

- Scheduled handlers
- Durable Objects
- Sandbox or isolated execution patterns
- Browser rendering or remote browser automation patterns

Rules:

- Put Worker examples under `app/worker/examples/`.
- Keep examples isolated from user-facing product code.
- Document examples in `CLOUDFLARE_EXAMPLES.md`.
- Clearly label examples as examples.
- State required bindings or Wrangler config.
- State whether the example is production-ready or only a starting point.
- Before implementing an example, read `.agents/skills/cloudflare/SKILL.md` and verify current product docs.
- If a feature uses one of these patterns for real, move it from `examples/` into actual app code deliberately.

## User-Facing Copy

Write product UI, not marketing.

Good:

- "Create project"
- "Upload failed"
- "Retry deployment"

Bad:

- "Let’s unlock your workflow"
- "Everything is ready for greatness"
- "Consult AGENTS.md before continuing"

## Feature Workflow

1. Decide whether the feature is a real user or agent capability.
2. Check `FEATURES.md` and `ROUTING_AND_DATA_FLOW.md` before inventing a new pattern.
3. Confirm the data model and backend ownership rules.
4. Define or extend the oRPC contract and handler for the capability.
5. Implement or update the Convex or backend logic behind it.
6. Expose initial page data through a TanStack loader using `context.getOrpc()`.
7. Return `dashboardHeader` from the loader when header copy or back navigation depends on loaded data.
8. Add a route `pendingComponent` with skeleton UI sized to the final page.
9. Add Convex hooks only if the page needs live reactive updates after render.
10. Compose the route and UI from existing primitives.
11. Verify auth and ownership.
12. Run checks.

## Checks

Always run:

```bash
npm run lint
npm run typecheck
npm run build
```

Also verify the relevant runtime path:

- Auth flows
- Dashboard navigation
- Schema ownership rules
- Design system page for UI additions

## Do Not

- Do not guess setup, deploy, auth, or environment configuration.
- Do not put business logic or ownership rules in route files.
- Do not treat `createServerFn` as the default product API.
- Do not use client-only hooks for initial page data when SSR loaders can fetch it.
- Do not add user-facing copy that exposes internal LLM instructions.

Convex agent skills can be installed with:

```bash
npx convex ai-files install
```
<!-- convex-ai-end -->
