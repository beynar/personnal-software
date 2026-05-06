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

`https://github.com/beynar/personnal-software`

## Workspace rule

The user prompt usually starts in an empty folder that is already meant to be
the project root.

- Put the template files at the root of the current working directory.
- Do not create a nested subfolder inside the current workspace.
- If the current directory is empty, clone directly into it, for example by
  using `git clone https://github.com/beynar/personnal-software .`.
- If the current directory cannot be cloned into directly, clone into a
  temporary location and copy the template contents into the current root
  without leaving the project nested in a child folder.
- If a project name is needed during bootstrap, derive a temporary one from the
  current folder name instead of asking the user first.
- If the current folder is not empty and cannot safely receive the template at
  its root, stop and explain the conflict instead of creating a surprise nested
  directory.

## Git history and remote rule

This template's git history is not the new app's history.

After the template files are materialized in the target workspace:

- remove the template repository's git metadata from the target workspace
- reinitialize git history for the new app with `git init`
- make sure there is no inherited `origin` remote pointing at the template repository
- create the first local commit only after bootstrap files and generated config are in a coherent state
- do not push to the template repository
- do not create a remote repository without asking the user first

After the initial bootstrap and deployment are complete, ask the user whether
they want a new remote GitHub repository for this app.

Before asking which account should own the remote, fetch the available GitHub
owner choices instead of guessing:

- use the installed GitHub app, `gh`, or another available GitHub integration
  to identify the authenticated user account
- fetch the organizations the authenticated user can create repositories under
- present the user with the available owner choices
- ask whether to create a new remote repository and, if yes, under which owner
- if the user declines, keep the repository local and do not add a remote

If the user asks to create the remote:

- create a new repository for the app under the selected user or organization
- add it as `origin`
- push the current branch
- report the remote URL

## Required workflow

1. Materialize the template repository at the root of the current working directory.
2. Reinitialize git history for the new app as described in the git history and remote rule.
3. Read these files in this exact order:
   - `AGENTS.md`
   - `BOOTSTRAP.md`
   - `FEATURES.md`
   - `DATA_MODEL.md`
   - `UI_SYSTEM.md`
   - `convex/_generated/ai/guidelines.md`
4. Bootstrap the template exactly as instructed by the repository.
5. During bootstrap, create a new Convex deployment dedicated to this app.
   - Do not attach this app to an unrelated existing Convex project or deployment.
   - Record the Convex deployment identifier and the Convex dashboard URL for the deployment you created.
6. Configure Cloudflare exactly as the repository expects.
7. Confirm the scaffold runs locally.
8. Deploy the scaffold to Cloudflare right away by following the repository's documented deployment flow.
9. Once deployed, immediately give the user:
   - the deployed Cloudflare app URL
   - the Convex dashboard URL for the new Convex deployment created for this app
   - the temporary `SUPER_ADMIN_SIGNUP_PASSWORD`
10. Ask the user whether to create a new remote GitHub repository, after fetching the available GitHub user and organization owner choices.
11. After that, use the `AskUserQuestion` tool to ask the user what they want built from the template.
12. Implement the requested product on top of the template.

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
- Do not keep the template repository's git history in the new app.
- Do not push to a remote until the user has explicitly chosen whether to create one and under which owner.
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
- git history was reinitialized for the new app
- no inherited template `origin` remote remains
- the docs were read
- the bootstrap succeeded
- the app runs locally
- a new Convex deployment dedicated to this app was created
- the Convex deployment identifier for that new deployment
- the app was deployed to Cloudflare
- the deployed Cloudflare app URL
- the Convex dashboard URL for the new Convex deployment
- which temporary `SUPER_ADMIN_SIGNUP_PASSWORD` was set

Then ask the user whether to create a new remote repository. Fetch and present
the available GitHub user and organization owner choices before asking the user
to choose an owner.

After the remote repository decision is handled, ask the user what they want
built.

After implementing the requested product, run the full verification again and
report the result.

## Required verification before finishing

Run:

```bash
npm run lint
npm run typecheck
npm run build
```
