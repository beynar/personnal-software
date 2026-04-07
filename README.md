# TanStack Start + Convex + Cloudflare Template

A full-stack starter template combining [TanStack Start](https://tanstack.com/start) for the frontend, [Convex](https://convex.dev) for the real-time backend, and [Cloudflare Workers](https://developers.cloudflare.com/workers/) for edge deployment. Includes authentication, file uploads, real-time data, and Cloudflare-specific patterns (Cron Triggers, Durable Objects).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | TanStack Start v1.167 (Vite-native, React 19) |
| Routing | TanStack Router (file-based, flat routes) |
| Backend | Convex (real-time database, auth, file storage) |
| Auth | `@convex-dev/auth` with Password provider |
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

### 2. Set up Convex

If you don't have the Convex CLI installed globally:

```bash
# Option A: Install globally
npm install -g convex

# Option B: Use npx (no global install needed)
npx convex dev
```

Create a new Convex deployment and push the schema:

```bash
npx convex dev
```

This will:
- Prompt you to log in (if not already)
- Create a new project/deployment
- Generate a `.env.local` file with your deployment credentials
- Start watching for backend changes

### 3. Configure environment variables

After running `npx convex dev`, a `.env.local` file is created automatically with:

```env
CONVEX_DEPLOYMENT=dev:your-deployment-name
VITE_CONVEX_URL=https://your-deployment-name.convex.cloud
```

If you need to create this file manually:

```bash
cp .env.local.example .env.local
# Edit .env.local with your Convex deployment URL
```

### 4. Start development

You need **two terminals** running simultaneously:

```bash
# Terminal 1 — Convex backend (watches convex/ for changes, syncs schema & functions)
npx convex dev

# Terminal 2 — TanStack Start dev server (Vite)
npm run dev
```

The app will be available at `http://localhost:5173`.

## Deployment to Cloudflare

Build and deploy to Cloudflare Workers:

```bash
npm run build
wrangler deploy
```

Or in one step:

```bash
npm run deploy
```

Make sure your Convex environment variables are set in your Cloudflare Worker settings or `wrangler.toml`.

For production Convex, deploy your backend first:

```bash
npx convex deploy --prod
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
│   ├── auth.ts                 # Auth configuration (Password provider)
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

Email/password authentication using `@convex-dev/auth` with the Password provider. Includes login and signup tabs with form validation and error handling.

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

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite dev server (port 5173) |
| `npm run build` | Build for production |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Deploy to Cloudflare Workers (`wrangler deploy`) |
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
