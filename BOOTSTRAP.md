# Bootstrap Runbook

This document is the canonical bootstrap procedure for this repository.

If you are an LLM or a human setting up a fresh clone, do not improvise. Follow these steps in order.

## What this project needs

This app depends on:

- Node.js and npm
- A Convex deployment
- Convex Auth environment variables and HTTP routes
- A local `.env.local` for Vite/TanStack Start
- Cloudflare Wrangler for deployment
- Wrangler-managed secrets/bindings for any deployed Worker

## Rules

- Do not guess environment variable names.
- Do not deploy before Convex is working locally.
- Do not assume Convex Auth is configured just because `convex/auth.ts` exists.
- Do not store secrets in `wrangler.toml`.
- Use the Wrangler CLI for deployed Worker secrets.

## 1. Install dependencies

```bash
npm install
```

## 2. Create or attach a Convex dev deployment

Run this from the repo root:

```bash
npx convex dev --once --typecheck disable
```

Expected result:

- Convex creates or connects to a dev deployment
- `.env.local` is written
- `VITE_CONVEX_URL` is populated

Verify:

```bash
cat .env.local
```

You should see at least:

```env
CONVEX_DEPLOYMENT=...
VITE_CONVEX_URL=...
```

## 3. Configure Convex Auth

This repo uses `@convex-dev/auth`. A fresh clone must configure the auth env vars too.

For local development, use the local dev URL on port `8888`:

```bash
npx @convex-dev/auth --web-server-url http://localhost:8888
```

This sets the required Convex auth variables such as:

- `SITE_URL`
- `JWT_PRIVATE_KEY`
- `JWKS`

It may also generate files such as:

- `convex/auth.config.ts`
- `convex/http.ts`
- `convex/tsconfig.json`

If those files already exist, keep them unless you know they are wrong.

## 4. Push Convex functions again

After auth setup, push the backend again:

```bash
npx convex dev --once --typecheck disable
```

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
3. Create a test account
4. Confirm you land on `/dashboard`
5. Visit `/examples/realtime`
6. Visit `/examples/file-upload`

If signup fails with `Missing environment variable JWT_PRIVATE_KEY`, step 3 was skipped or failed.

If the page renders but buttons/forms do nothing, the client entry is broken. Check `app/client.tsx`.

If Convex websocket requests hit `//api/...`, the Convex URL normalization is wrong. Check `app/routes/__root.tsx`.

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
ANTHROPIC_API_KEY=...
```

### 7.3 Configure Convex Auth for the deployed site URL

Convex Auth needs the final public site URL.

If you know the final deployed URL already, configure Convex Auth before deploy:

```bash
npx @convex-dev/auth --prod --web-server-url https://your-public-site.example.com
npx convex deploy
```

If you do not know the final Cloudflare URL yet:

1. Deploy once with Wrangler
2. Copy the resulting `workers.dev` or custom-domain URL
3. Run the auth command with that URL
4. Deploy again

Example:

```bash
npx @convex-dev/auth --prod --web-server-url https://your-worker.your-subdomain.workers.dev
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

- `SITE_URL` in Convex does not match the deployed site URL
- `VITE_CONVEX_URL` in the deployed Worker does not match the intended Convex deployment
- The Worker was deployed without the needed Wrangler secrets

## 9. Minimal bootstrap command summary

Local:

```bash
npm install
npx convex dev --once --typecheck disable
npx @convex-dev/auth --web-server-url http://localhost:8888
npx convex dev --once --typecheck disable
npm run dev
```

Deploy:

```bash
npx wrangler login
npx convex deploy
npx @convex-dev/auth --prod --web-server-url https://your-public-site.example.com
npx convex deploy
set -a
source ./.env.production.local
set +a
printf '%s' "$VITE_CONVEX_URL" | npx wrangler secret put VITE_CONVEX_URL
printf '%s' "$VITE_CONVEX_SITE_URL" | npx wrangler secret put VITE_CONVEX_SITE_URL
printf '%s' "$ANTHROPIC_API_KEY" | npx wrangler secret put ANTHROPIC_API_KEY
npm run deploy
```
