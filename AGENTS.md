<!-- convex-ai-start -->
# Agent Guide

Read this first.

## Read Order

1. `AGENTS.md`
2. `BOOTSTRAP.md` before setup, auth config, or deploy
3. `FEATURES.md` before adding routes or Convex APIs
4. `DATA_MODEL.md` before changing schema or indexes
5. `UI_SYSTEM.md` before adding or composing UI
6. `convex/_generated/ai/guidelines.md` before writing Convex code

## Stack

- React 19
- TanStack Start + TanStack Router
- Convex
- `@convex-dev/auth`
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

## UI Rules

- use existing primitives first
- use tokens from `app/app.css`
- keep user-facing pages under the dashboard layout when the sidebar should persist
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

1. confirm the data model
2. add Convex functions
3. add route/page composition
4. compose from existing UI primitives
5. verify auth and ownership
6. run checks

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
- do not guess env names, auth domains, or deploy commands
- do not add user-facing copy that exposes internal LLM instructions

Convex agent skills can be installed with:

```bash
npx convex ai-files install
```
<!-- convex-ai-end -->
