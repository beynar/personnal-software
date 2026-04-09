# Bootstrap Runbook

This document is the canonical bootstrap procedure for this repository.

If you are an LLM or a human setting up a fresh clone, do not improvise. Follow these steps in order.

## What this project needs

This app depends on:

- Node.js and npm
- A Convex deployment
- Better Auth environment variables (`BETTER_AUTH_SECRET`, `SITE_URL`)
- A local `.env.local` for Vite/TanStack Start (`VITE_CONVEX_URL`, `VITE_CONVEX_SITE_URL`, `VITE_SITE_URL`)
- Cloudflare Wrangler for deployment
- Wrangler-managed secrets/bindings for any deployed Worker

## Rules

- Do not guess environment variable names.
- Do not deploy before Convex is working locally.
- Do not assume Better Auth is configured just because `convex/auth.ts` exists.
- Do not store secrets in `wrangler.toml`.
- Use the Wrangler CLI for deployed Worker secrets.

## 1. Install dependencies

```bash
npm install
```

## 2. Create a new Convex dev deployment for this app

Run this from the repo root:

```bash
npx convex dev --once --typecheck disable
```

Expected result:

- Convex creates a new dev deployment dedicated to this app
- you record the Convex deployment identifier for that new deployment
- `.env.local` is written
- `VITE_CONVEX_URL` is populated
- you ensure `VITE_CONVEX_SITE_URL`, `VITE_SITE_URL`, and `VITE_PROJECT_NAME` are present before local auth testing

Important:

- Do not attach this app to an unrelated existing Convex project or deployment.
- If the Convex CLI offers multiple existing deployments, create a new one for this app instead of picking an unrelated existing target.

Verify:

```bash
cat .env.local
```

You should see or add at least:

```env
CONVEX_DEPLOYMENT=...
VITE_CONVEX_URL=...
VITE_CONVEX_SITE_URL=...
VITE_SITE_URL="http://localhost:8888"
VITE_PROJECT_NAME="Your Project Name"
```

If `VITE_PROJECT_NAME`, `VITE_CONVEX_SITE_URL`, or `VITE_SITE_URL` is missing,
add it manually to `.env.local` before local auth testing. `VITE_PROJECT_NAME`
is used for the sign-in screen, the document title, and the dashboard brand.

## 3. Configure Better Auth environment variables

This repo uses `@convex-dev/better-auth` (a local Convex component backed by Better Auth).

Set the following environment variables on your Convex deployment:

```bash
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL "http://localhost:8888"
```

Required Convex env vars:

- `BETTER_AUTH_SECRET` — signing key for sessions and tokens
- `SITE_URL` — the public URL where the app is served
- `SUPER_ADMIN_SIGNUP_PASSWORD` — gate for account creation (optional for local dev)

Required `.env.local` vars (Vite build-time):

- `VITE_CONVEX_URL` — Convex deployment URL (set automatically by `npx convex dev`)
- `VITE_CONVEX_SITE_URL` — Convex site URL for HTTP routes
- `VITE_SITE_URL` — public site URL (e.g. `http://localhost:8888`)

## 4. Push Convex functions again

After auth setup, push the backend again:

```bash
npx convex dev --once --typecheck disable
```

## 4.1 Configure the signup secret in Convex

Account creation is restricted in `convex/auth.ts`. Set the signup secret on the
Convex deployment before testing sign up:

```bash
npx convex env set SUPER_ADMIN_SIGNUP_PASSWORD "choose-a-long-random-secret"
```

Use the same command against the production deployment before `npx convex deploy`.

## 5. Start local development

Run the app:

```bash
npm run dev
```

The local app runs on:

```text
http://localhost:8888
```

If you need Convex file/function watching at the same time, run this in a second terminal:

```bash
npx convex dev
```

## 6. Local verification checklist

Before deploying, verify these manually:

1. Open `http://localhost:8888`
2. Confirm the login/signup UI renders
3. Create a test account with the super admin password
4. Confirm you land on `/dashboard`
5. Visit `/examples/realtime`
6. Visit `/examples/file-upload`

If signup fails with `Missing environment variable BETTER_AUTH_SECRET`, step 3 was skipped or failed.

If the page renders but buttons/forms do nothing, the client entry is broken. Check `app/client.tsx`.

If Convex websocket requests hit `//api/...`, the Convex URL normalization is wrong. Check `app/routes/__root.tsx`.

### Machine access verification

After creating an account, verify REST and MCP auth:

1. Create an API key from the dashboard account menu → "API keys"
2. Copy the raw key (shown once at creation time)
3. Verify REST rejection without a key:
   ```bash
   curl -X POST "http://localhost:8888/api/v1/examples/bootstrap/workflow?q=hello&limit=2&dryRun=true&channel=email" \
     -H "Content-Type: application/json" \
     -d '{"message":"Bootstrap","priority":"high"}'
   # expect 401
   ```
4. Verify REST success with a key:
   ```bash
   curl -X POST "http://localhost:8888/api/v1/examples/bootstrap/workflow?q=hello&limit=2&dryRun=true&channel=email" \
     -H "Authorization: Bearer bd_your_key" \
     -H "Content-Type: application/json" \
     -d '{"message":"Bootstrap","priority":"high"}'
   # expect 200 with JSON
   ```
5. Verify API reference loads: open `http://localhost:8888/api/v1/docs`
6. Verify MCP with API key:
   ```bash
   curl -X POST -H "x-api-key: bd_your_key" \
     -H "Content-Type: application/json" \
     -d '{"jsonrpc":"2.0","method":"tools/list","id":1}' \
     http://localhost:8888/api/mcp
   # expect JSON-RPC response with tool list
   ```

The `execute` MCP tool runs JavaScript inside a Cloudflare dynamic worker sandbox. The sandbox does not receive raw credentials directly; it gets a host-exposed `api.*` proxy over executable OpenAPI routes with auth forwarded by the host.

Proxy conventions:

- Static segments become chained properties, for example `api.examples.exampleId.workflow.post(...)`
- Parameterized path segments become plain parameter-name properties, for example `api.examples.exampleId.workflow.post({ params: { exampleId: "sample" } })`
- Route method calls accept an object with optional `params`, `query`, `headers`, and `body`

Example route:

```js
async () =>
  await api.examples.exampleId.workflow.post({
    params: { exampleId: "sample" },
    query: { q: "widget", limit: 5, dryRun: true, channel: "email" },
    body: { message: "hello", priority: "high" },
  })
```

This route is intentionally a removable example. It combines path params, query params, a JSON body, and a typed JSON response so the MCP/OpenAPI bridge can be exercised end-to-end before real product routes replace it.

## 7. Cloudflare deployment with Wrangler CLI

This section is mandatory for deployed environments.

### 7.1 Authenticate Wrangler

```bash
npx wrangler login
```

Optional sanity check:

```bash
npx wrangler whoami
```

### 7.2 Decide which Convex deployment Cloudflare should use

You have two choices:

- Quick path: reuse the Convex deployment from `.env.local`
- Production path: create a dedicated production Convex deployment

For anything user-facing, prefer the production path:

```bash
npx convex deploy
```

Important:

- Do not guess the production Convex URLs.
- Copy the production `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL` from a verified source such as the Convex dashboard or a CLI output you trust.

Create a local file for deploy-time values if needed:

```env
# .env.production.local
VITE_CONVEX_URL=...
VITE_CONVEX_SITE_URL=...
VITE_PROJECT_NAME="Your Project Name"
ANTHROPIC_API_KEY=...
```

### 7.3 Configure Better Auth for the deployed site URL

Better Auth needs the final public site URL set as `SITE_URL` on the Convex deployment.

If you know the final deployed URL already, configure it before deploy:

```bash
npx convex env set SITE_URL "https://your-public-site.example.com" --prod
npx convex deploy
```

If you do not know the final Cloudflare URL yet:

1. Deploy once with Wrangler
2. Copy the resulting `workers.dev` or custom-domain URL
3. Set `SITE_URL` to that URL
4. Deploy again

Example:

```bash
npx convex env set SITE_URL "https://your-worker.your-subdomain.workers.dev" --prod
npx convex deploy
```

### 7.4 Push Worker secrets with Wrangler CLI

Use Wrangler CLI for deployed secrets and bindings. Do not put secrets in `wrangler.toml`.

Load your deploy-time env file into the shell:

```bash
set -a
source ./.env.production.local
set +a
```

Push required values with Wrangler:

```bash
printf '%s' "$VITE_CONVEX_URL" | npx wrangler secret put VITE_CONVEX_URL
printf '%s' "$VITE_CONVEX_SITE_URL" | npx wrangler secret put VITE_CONVEX_SITE_URL
```

If you use Anthropic features, also set:

```bash
printf '%s' "$ANTHROPIC_API_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
```

Also set the signup secret on the target Convex deployment:

```bash
npx convex env set SUPER_ADMIN_SIGNUP_PASSWORD "choose-a-long-random-secret"
```

Notes:

- `VITE_CONVEX_URL` is not sensitive, but storing it through Wrangler keeps the deployed Worker configuration reproducible through CLI commands.
- The client bundle still needs the same values available at build time, so keep `.env.production.local` or export them in the deploy shell before `wrangler deploy`.

### 7.5 Build and deploy the Worker

This repo's deploy path is:

1. build the production client and SSR worker bundle
2. deploy the generated server config at `dist/server/wrangler.json`

`npm run deploy` now does both.

Run the deploy with the same environment loaded:

```bash
set -a
source ./.env.production.local
set +a
npm run deploy
```

If you use Wrangler environments, include `--env <name>` consistently for both `wrangler secret put` and `wrangler deploy`.

## 8. Post-deploy verification

After deployment:

1. Open the deployed URL
2. Confirm the auth page loads
3. Create or log into an account
4. Confirm `/dashboard` works
5. Confirm `/examples/realtime` works
6. Confirm `/examples/file-upload` loads

If deployed auth fails but local auth works, the usual cause is one of:

- `SITE_URL` on the Convex deployment does not match the deployed site URL
- `BETTER_AUTH_SECRET` is not set on the Convex deployment
- `VITE_CONVEX_URL` in the deployed Worker does not match the intended Convex deployment
- The Worker was deployed without the needed Wrangler secrets

## 9. Minimal bootstrap command summary

Local:

```bash
npm install
npx convex dev --once --typecheck disable
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)"
npx convex env set SITE_URL "http://localhost:8888"
npx convex dev --once --typecheck disable
npm run dev
```

Deploy:

```bash
npx wrangler login
npx convex deploy
npx convex env set BETTER_AUTH_SECRET "$(openssl rand -base64 32)" --prod
npx convex env set SITE_URL "https://your-public-site.example.com" --prod
npx convex env set SUPER_ADMIN_SIGNUP_PASSWORD "choose-a-long-random-secret" --prod
npx convex deploy
set -a
source ./.env.production.local
set +a
printf '%s' "$VITE_CONVEX_URL" | npx wrangler secret put VITE_CONVEX_URL
printf '%s' "$VITE_CONVEX_SITE_URL" | npx wrangler secret put VITE_CONVEX_SITE_URL
printf '%s' "$ANTHROPIC_API_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```
