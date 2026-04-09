# TanStack Start + Convex + Cloudflare Template

A full-stack starter template combining [TanStack Start](https://tanstack.com/start) for the frontend, [Convex](https://convex.dev) for the real-time backend, and [Cloudflare Workers](https://developers.cloudflare.com/workers/) for edge deployment. Includes authentication, file uploads, real-time data, and Cloudflare-specific patterns (Cron Triggers, Durable Objects).

## Bootstrap First

For a fresh clone, follow [BOOTSTRAP.md](./BOOTSTRAP.md) before doing anything else. It contains the exact local bootstrap flow, Convex Auth setup, and the Wrangler-based Cloudflare deployment procedure for this repo.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start v1.167 (Vite-native, React 19) |
| Routing | TanStack Router (file-based, flat routes) |
| Backend | Convex (real-time database, auth, file storage) |
| Auth | `@convex-dev/better-auth` (Better Auth local component) |
| Styling | Tailwind CSS v4, shadcn/ui components |
| Edge Runtime | Cloudflare Workers (via `@cloudflare/vite-plugin`) |
| Tooling | Biome (lint + format), TypeScript 5.9 |

## Prerequisites

- **Node.js** >= 18
- **npm** (comes with Node.js)
- A [Convex](https://convex.dev) account (free tier available)
- A [Cloudflare](https://dash.cloudflare.com) account (for deployment)

## Getting Started

### 1. Clone and install dependencies

```bash
git clone <repo-url>
cd personnal-software
npm install
```

### 2. Bootstrap the project

Do not improvise the setup. Follow [BOOTSTRAP.md](./BOOTSTRAP.md) exactly.

The short version is:

```bash
npm install
npx convex dev --once --typecheck disable
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL "http://localhost:8888"
npx convex dev --once --typecheck disable
npm run dev
```

The local app runs at `http://localhost:8888`.

If you want live Convex watching in parallel, run `npx convex dev` in a second terminal.

## Deployment to Cloudflare

Use [BOOTSTRAP.md](./BOOTSTRAP.md) for the full deploy procedure.

Important details:

- Deploy Convex first with `npx convex deploy`
- Set `BETTER_AUTH_SECRET` and `SITE_URL` on the production Convex deployment
- Push Worker secrets with Wrangler CLI, not `wrangler.toml`
- Deploy the generated SSR worker config at `dist/server/wrangler.json`

The repository script already does the correct Worker deploy:

```bash
npm run deploy
```

## Project Structure

```
.
├── app/                        # Frontend application (TanStack Start)
│   ├── client.tsx              # Client entry point
│   ├── server.ts               # Server entry point
│   ├── ssr.tsx                 # SSR handler
│   ├── router.tsx              # Router configuration (exports getRouter)
│   ├── app.css                 # Global styles + Tailwind v4 theme
│   ├── routes/                 # File-based routes (flat convention)
│   │   ├── __root.tsx          # Root layout (ConvexAuthProvider, head tags)
│   │   ├── index.tsx           # Login/Signup page (/)
│   │   ├── dashboard.tsx       # Authenticated dashboard (/dashboard)
│   │   └── examples.*.tsx      # Example pattern pages (/examples/*)
│   ├── components/
│   │   └── ui/                 # shadcn/ui components (Button, Card, Input, etc.)
│   ├── lib/
│   │   └── utils.ts            # cn() helper (clsx + tailwind-merge)
│   └── worker/                 # Cloudflare Worker modules
│       ├── scheduled.ts        # Cron Trigger handler
│       └── rate-limiter.ts     # Durable Object: rate limiter
├── convex/                     # Convex backend
│   ├── schema.ts               # Database schema (auth tables, files, counters)
│   ├── auth.ts                 # Auth configuration (Better Auth + MCP)
│   ├── convex.config.ts        # Convex app config
│   ├── users.ts                # User queries (viewer)
│   ├── files.ts                # File upload/download/delete mutations & queries
│   └── realtime.ts             # Real-time counter queries & mutations
├── vite.config.ts              # Vite config (TanStack Start + Cloudflare + Tailwind)
├── wrangler.toml               # Cloudflare Workers config (cron triggers, DOs)
├── tsconfig.json               # TypeScript configuration
├── biome.json                  # Biome linter/formatter config
├── components.json             # shadcn/ui configuration
└── package.json                # Dependencies and scripts
```

## How The Starter Is Layered

This starter is organized around a few clear boundaries:

- `app/routes/*` handles page routing, page composition, redirects, and HTTP entrypoints
- `app/components/*` handles feature UI, while `app/components/ui/*` is reserved for reusable primitives
- `convex/*` holds persistent data, business logic, ownership checks, and application APIs
- `app/lib/api.ts` exposes the REST/OpenAPI surface for machine-readable HTTP access
- `app/lib/mcp.ts` keeps the MCP layer thin by deriving route discovery and execution from the OpenAPI catalog instead of hand-writing one MCP tool per route
- Better Auth provides the auth boundary across browser sessions, API keys, REST access, and MCP access

In practice, that means:

- add user-facing pages in `app/routes/`
- add durable product logic in `convex/`
- expose machine-facing routes through the OpenAPI-backed API layer
- let MCP discover and execute those capabilities through the OpenAPI-driven bridge

The intended flow is: UI routes compose product features, Convex owns core data rules, OpenAPI exposes machine-facing routes, and MCP gives LLMs a thin programmable layer over that documented API surface.

## Example Patterns

### Authentication (Login/Signup)
**Route:** `/`

Email/password authentication using `@convex-dev/better-auth` with Better Auth's email provider. Includes login and signup tabs with form validation and error handling. Organization management, API key management, and provisional MCP auth support are available as Better Auth plugins.

### Authenticated Dashboard
**Route:** `/dashboard`

Protected route using Convex's `<Authenticated>` / `<Unauthenticated>` components for reactive auth guards. Displays user info and sign-out functionality.

### File Upload
**Route:** `/examples/file-upload`

Complete file upload flow using Convex storage: generate upload URL, POST file with progress tracking (via XMLHttpRequest), save metadata, list files with download links, and delete files.

### Real-time Data
**Route:** `/examples/realtime`

Shared counters demonstrating Convex's real-time subscriptions. Multiple users see instant updates. Includes optimistic updates for snappy UI feedback.

### Cron Triggers
**File:** `app/worker/scheduled.ts`

Cloudflare scheduled event handler with example patterns for hourly cleanup, daily archival, and weekly digests. Enable by uncommenting the `[triggers]` section in `wrangler.toml`.

### Durable Objects (Rate Limiter)
**File:** `app/worker/rate-limiter.ts`

Sliding-window rate limiter implemented as a Cloudflare Durable Object with alarm-based cleanup. Enable by uncommenting the Durable Objects bindings in `wrangler.toml`.

## Machine Access (REST and MCP)

This repo exposes two machine interfaces: a REST API and an MCP server. Both require authentication.

### REST API (`/api/v1/*`)

All REST endpoints require `Authorization: Bearer <api-key>`. Create an API key from the dashboard account menu.

```bash
curl -X POST "https://your-app.example.com/api/v1/examples/sample/workflow?q=widget&limit=5&dryRun=true&channel=email" \
  -H "Authorization: Bearer bd_your_key_here" \
  -H "Content-Type: application/json" \
  -d '{"message":"hello","priority":"high"}'
```

The OpenAPI spec and interactive API reference are publicly accessible without a key:

- `GET /api/v1/openapi.json` — machine-readable OpenAPI 3.1 spec
- `GET /api/v1/docs` — interactive API reference (Scalar)

To make authenticated requests from the API reference page, paste your API key into the authentication panel.

### MCP server (`/api/mcp`)

The MCP server accepts two authentication methods:

| Method | Header | Use case |
|--------|--------|----------|
| Bearer token | `Authorization: Bearer <token>` | OAuth 2.0 flow — MCP clients that complete the authorization dance |
| API key | `x-api-key: bd_your_key_here` | Direct access — scripts, CI, or MCP clients that skip OAuth |

MCP discovery endpoints (served by Better Auth's `mcp` plugin):

- `/.well-known/oauth-authorization-server` — OAuth discovery metadata
- `/.well-known/oauth-protected-resource` — protected resource metadata
- `/mcp/authorize` — authorization endpoint
- `/mcp/token` — token endpoint
- `/mcp/register` — dynamic client registration

**Note:** Better Auth marks the `mcp` plugin as heading toward deprecation in favor of the `oidc-provider` (OAuth Provider) plugin. The current integration works today, but plan to migrate when the OAuth Provider plugin stabilizes.

### MCP tools

The MCP server exposes two tools:

| Tool | Description |
|------|-------------|
| `search-routes` | Searches the OpenAPI route catalog and returns compact route signatures |
| `execute` | Executes JavaScript inside a Cloudflare dynamic worker sandbox |

### OpenAPI-driven MCP model

The MCP integration is intentionally driven by the OpenAPI spec:

- OpenAPI is the source of truth for executable API capabilities
- `search-routes` is derived from the current OpenAPI catalog and returns compact, LLM-friendly route signatures
- `execute` builds the sandbox `api.*` proxy from the executable OpenAPI route catalog instead of from hand-written MCP tools
- adding or changing an OpenAPI route updates route discovery automatically
- route execution still depends on the proxy conventions documented below, plus host-side auth forwarding and request validation

This keeps the MCP surface thin: route discovery happens through `search-routes`, and route orchestration happens inside `execute`.

### Sandboxed code execution

The `execute` tool runs code through `DynamicWorkerExecutor` using the Cloudflare Worker loader binding. The caller sends JavaScript, the host runs it inside an isolated Worker sandbox, and the sandbox can interact with executable OpenAPI routes through a recursive `api.*` proxy.

Route discovery stays at the MCP top level through `search-routes`, which returns compact text signatures with TypeScript-like `input` and `output` types.

Proxy conventions:

- Static segments become chained properties, for example `POST /api/v1/examples/{exampleId}/workflow` becomes `api.examples.exampleId.workflow.post(...)`
- Parameterized path segments become plain parameter-name properties, for example `POST /api/v1/examples/{exampleId}/workflow` becomes `api.examples.exampleId.workflow.post({ params: { exampleId: "sample" } })`
- Route method calls accept an object with optional `params`, `query`, `headers`, and `body`

Example route:

- `POST /api/v1/examples/{exampleId}/workflow`

This route is intentionally an OpenAPI/MCP example route. It combines:

- a path param: `exampleId`
- query params: `q`, `limit`, `dryRun`, `channel`
- a JSON body: `message`, `priority`
- a typed JSON response

It exists to demonstrate the proxy and is safe to remove once real product routes cover the same patterns.

Proxy example:

- `await api.examples.exampleId.workflow.post({ params: { exampleId: "sample" }, query: { q: "widget", limit: 5, dryRun: true, channel: "email" }, body: { message: "hello", priority: "high" } })`

### Verification checklist

After setting up auth and API keys, verify the following:

- [ ] **Unauthenticated REST rejection**: `curl -X POST "https://your-app.example.com/api/v1/examples/sample/workflow?q=widget&limit=5&dryRun=true&channel=email" -H "Content-Type: application/json" -d '{"message":"hello","priority":"high"}'` returns `401`
- [ ] **Authenticated REST success**: `curl -X POST "https://your-app.example.com/api/v1/examples/sample/workflow?q=widget&limit=5&dryRun=true&channel=email" -H "Authorization: Bearer bd_..." -H "Content-Type: application/json" -d '{"message":"hello","priority":"high"}'` returns `200`
- [ ] **Protected OpenAPI behavior**: `GET /api/v1/docs` loads the API reference without a key; making a request from the docs UI without a key shows a `401`
- [ ] **Bearer MCP success**: An MCP client that completed the OAuth flow can call `tools/list` and `tools/call` on `/api/mcp`
- [ ] **API-key MCP success**: `curl -X POST -H "x-api-key: bd_..." -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' https://your-app.example.com/api/mcp` returns the tool list
- [ ] **search-routes tool**: Calling `search-routes` with `{"query":"example, workflow, channel"}` returns the example route signature for `examples/{exampleId}/workflow`
- [ ] **execute tool with body**: Calling `execute` with `{"code":"async () => await api.examples.exampleId.workflow.post({ params: { exampleId: \"sample\" }, query: { q: \"widget\", limit: 5, dryRun: true, channel: \"email\" }, body: { message: \"hello\", priority: \"high\" } })"}` returns the sandbox result envelope
- [ ] **execute tool with full example route**: Calling `execute` with `{"code":"async () => await api.examples.exampleId.workflow.post({ params: { exampleId: \"sample\" }, query: { q: \"widget\", limit: 5, dryRun: true, channel: \"email\" }, body: { message: \"hello\", priority: \"high\" } })"}` returns the sandbox result envelope

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server on port 8888 |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build and deploy the generated Cloudflare Worker config |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run Biome linter |
| `npm run lint:fix` | Auto-fix lint and formatting issues |

## Routing Convention

This project uses TanStack Router's **flat file-based routing** with dot notation:

- `routes/index.tsx` &rarr; `/`
- `routes/dashboard.tsx` &rarr; `/dashboard`
- `routes/examples.file-upload.tsx` &rarr; `/examples/file-upload`
- `routes/examples.realtime.tsx` &rarr; `/examples/realtime`

## Path Aliases

The `~` alias maps to the `app/` directory. Use it for clean imports:

```tsx
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
```

Configured in both `tsconfig.json` (for type checking) and `vite.config.ts` (for bundling).
