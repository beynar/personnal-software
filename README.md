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
cd bubbly-dragon
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

All REST endpoints require the `x-api-key` header. Create an API key from the dashboard account menu.

```bash
curl -H "x-api-key: bd_your_key_here" https://your-app.example.com/api/v1/test
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

The MCP server exposes three tools:

| Tool | Description |
|------|-------------|
| `get-profile` | Returns the authenticated user's profile |
| `search-routes` | Searches the OpenAPI route catalog by keyword |
| `execute` | Executes an API request against the REST API |

### Host-side request proxying

The `execute` tool uses host-side request proxying rather than exposing credentials inside sandboxed code. When a tool call arrives, the MCP server constructs and dispatches the HTTP request on the host using the caller's credentials. The sandboxed environment never receives API keys or tokens — it only describes what request to make and receives the response envelope.

This means:

- Sandboxed code cannot leak or misuse credentials
- API-key callers get their key forwarded to the REST API automatically
- Bearer-token callers can call any MCP tool but may receive a `401` from API-key-only REST endpoints (this is surfaced via an `authNote` field in the response)

### Verification checklist

After setting up auth and API keys, verify the following:

- [ ] **Unauthenticated REST rejection**: `curl https://your-app.example.com/api/v1/test` returns `401`
- [ ] **Authenticated REST success**: `curl -H "x-api-key: bd_..." https://your-app.example.com/api/v1/test` returns `200`
- [ ] **Protected OpenAPI behavior**: `GET /api/v1/docs` loads the API reference without a key; making a request from the docs UI without a key shows a `401`
- [ ] **Bearer MCP success**: An MCP client that completed the OAuth flow can call `tools/list` and `tools/call` on `/api/mcp`
- [ ] **API-key MCP success**: `curl -X POST -H "x-api-key: bd_..." -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' https://your-app.example.com/api/mcp` returns the tool list
- [ ] **search-routes tool**: Calling `search-routes` with `{"query":"test"}` returns the `/api/v1/test` endpoint
- [ ] **execute tool**: Calling `execute` with `{"method":"GET","path":"/test"}` returns the test endpoint response

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
