# Template Bootstrap Prompt

You are starting from a template repository, not from scratch.

## Initial requirement

Do not ask the user what to build yet.

First, scaffold and bootstrap the template in the current workspace, create a
new Convex deployment dedicated to this app, deploy the scaffold, and report
the deployment details.
Only after that should you use the `AskUserQuestion` tool to ask the user what
they want built on top of the template.

## Template repository

Use this repository as the base:

`https://github.com/beynar/bubbly-dragon`

## Workspace rule

The user prompt usually starts in an empty folder that is already meant to be
the project root.

- Put the template files at the root of the current working directory.
- Do not create a nested subfolder inside the current workspace.
- If the current directory is empty, clone directly into it, for example by
  using `git clone https://github.com/beynar/bubbly-dragon .`.
- If the current directory cannot be cloned into directly, clone into a
  temporary location and copy the template contents into the current root
  without leaving the project nested in a child folder.
- If a project name is needed during bootstrap, derive a temporary one from the
  current folder name instead of asking the user first.
- If the current folder is not empty and cannot safely receive the template at
  its root, stop and explain the conflict instead of creating a surprise nested
  directory.

## Required workflow

1. Materialize the template repository at the root of the current working directory.
2. Read these files in this exact order:
   - `AGENTS.md`
   - `BOOTSTRAP.md`
   - `FEATURES.md`
   - `DATA_MODEL.md`
   - `UI_SYSTEM.md`
   - `convex/_generated/ai/guidelines.md`
3. Bootstrap the template exactly as instructed by the repository.
4. During bootstrap, create a new Convex deployment dedicated to this app.
   - Do not attach this app to an unrelated existing Convex project or deployment.
   - Record the Convex deployment identifier and the Convex dashboard URL for the deployment you created.
5. Configure Cloudflare exactly as the repository expects.
6. Confirm the scaffold runs locally.
7. Deploy the scaffold to Cloudflare right away by following the repository's documented deployment flow.
8. Once deployed, immediately give the user:
   - the deployed Cloudflare app URL
   - the Convex dashboard URL for the new Convex deployment created for this app
   - the temporary `SUPER_ADMIN_SIGNUP_PASSWORD`
9. After that, use the `AskUserQuestion` tool to ask the user what they want built from the template.
10. Implement the requested product on top of the template.

## Bootstrap-specific instruction

During bootstrap, set a short temporary value for `SUPER_ADMIN_SIGNUP_PASSWORD`
so signup can be tested quickly.

Rules for this temporary password:

- make it short
- make it easy to type
- use it only as a bootstrap/dev password
- tell the user explicitly what password you chose
- clearly say that it must be changed before any real deployment or public usage

Example acceptable temporary password:

`admin123`

## Non-negotiable rules

- Do not start from an empty app.
- Do not invent a different stack.
- Do not replace TanStack Start, Convex, or the existing deployment model unless explicitly required.
- Do not guess env var names, auth setup, or deploy commands.
- Do not invent a parallel UI system.
- Do not expose internal setup docs in the user-facing app.
- Do not commit secrets.
- Deployment is required. Follow the repo's Wrangler and Cloudflare instructions exactly.
- The Convex URL given back to the user must be the Convex dashboard URL for the new deployment created during bootstrap, not just the public `VITE_CONVEX_URL`.

## How to work

After bootstrap and deployment are complete, ask the user what they want built
and use the template as the base.

While implementing the requested product:

- keep the existing repo structure unless there is a strong reason to change it
- reuse existing components and patterns before creating new ones
- keep UI work aligned with `UI_SYSTEM.md`
- keep data modeling aligned with `DATA_MODEL.md`
- keep feature placement aligned with `FEATURES.md`
- keep Convex code aligned with `convex/_generated/ai/guidelines.md`

## Required output behavior

Before asking the user what to build, explicitly confirm:

- the template repository was copied into the root of the current workspace
- the docs were read
- the bootstrap succeeded
- the app runs locally
- a new Convex deployment dedicated to this app was created
- the Convex deployment identifier for that new deployment
- the app was deployed to Cloudflare
- the deployed Cloudflare app URL
- the Convex dashboard URL for the new Convex deployment
- which temporary `SUPER_ADMIN_SIGNUP_PASSWORD` was set

Then ask the user what they want built.

After implementing the requested product, run the full verification again and
report the result.

## Required verification before finishing

Run:

```bash
npm run lint
npm run typecheck
npm run build
```
