# Data Model Guide

This file defines the database rules for this repository.

Read this before adding tables, relations, indexes, or new Convex APIs.

## Core rule

Optimize for explicit ownership, bounded reads, and predictable indexes.

If a query would need `filter`, the schema is probably missing an index.

## Current baseline

The starter schema currently contains:

- auth tables from `@convex-dev/auth`
- `users`
- `counters`
- `files`

Schema lives in `convex/schema.ts`.

## Table design rules

When adding a table:

- create it in `convex/schema.ts`
- give it one clear responsibility
- store foreign keys explicitly with `v.id("tableName")`
- avoid mixing stable profile data with high-churn operational state
- avoid embedding unbounded child arrays in parent documents

Good:

- `projects`
- `projectMembers`
- `messages`
- `messageReactions`

Bad:

- one `project` document with a growing `messages: v.array(...)`
- one `user` document that also stores fast-changing presence state

## Relation patterns

Use explicit tables for one-to-many and many-to-many relations.

Patterns:

- one-to-many: child table stores the parent id
- many-to-many: join table stores both ids
- ownership: store the owner id directly on the owned record unless a join table is the actual authority

Examples:

- `tasks.projectId`
- `comments.taskId`
- `projectMembers.projectId` and `projectMembers.userId`

## Ownership rules

Ownership must be enforceable in Convex, not inferred only in the UI.

Rules:

- derive the current user from auth server-side
- use the authenticated user record or token identity as the authority
- check ownership before patch, replace, or delete
- reject unauthorized writes with an error

Do not:

- accept a `userId` argument and trust it
- rely on route guards alone for data protection

## Index naming

Index names must describe the queried fields in order.

Use:

- `by_user`
- `by_project`
- `by_project_and_status`
- `by_owner_and_created_at`

Do not use vague names like:

- `primary`
- `lookup`
- `searchIndex1`

If queries need both `(projectId, status)` and `(status, projectId)`, define two indexes.

## Query defaults

Default to bounded results.

Rules:

- do not use `filter` on Convex queries
- prefer `.unique()`, `.take(n)`, or pagination
- do not use `.collect()` unless the collection is truly bounded and small
- if a list can grow, paginate it

Recommended defaults:

- use `.unique()` for unique lookups
- use `.take(20)` or `.take(50)` for small bounded lists
- use `paginationOptsValidator` for user-facing feeds, tables, and histories

## Pagination defaults

For new list UIs, pagination is the default unless the list is obviously tiny.

Use pagination for:

- activity feeds
- message lists
- audit logs
- user-owned collections that can grow over time

Use bounded `.take(...)` only for:

- dashboards
- previews
- recent items widgets
- short pickers

## Mutation design

Mutations should do one write job well.

Rules:

- keep writes transactional and local
- if work exceeds transaction limits, batch it and reschedule
- maintain denormalized counters intentionally when count-at-scale matters
- patch only the fields you intend to change

If a mutation needs external I/O, split it:

- `action` performs external work
- `mutation` persists database changes

## Search and derived data

If a feature needs search:

- add a search index explicitly
- scope search with additional equality constraints when possible

If a feature needs fast counts or summaries:

- maintain dedicated summary fields or summary documents
- do not rely on collecting full tables to compute totals

## File and blob metadata

For uploaded files:

- store the blob in Convex storage
- store metadata in a normal table
- link metadata to the owning user or entity
- verify ownership before delete

## Component registry note

This repo does not currently use Convex components as a backend architecture layer.

- `convex/_generated/api.d.ts` currently exposes `components: {}`.
- Do not invent component-based data boundaries unless the feature actually needs them.
- Use plain domain files in `convex/` by default.
- If backend complexity grows enough to justify a Convex component, document the boundary first and then use the dedicated component skill.

## Verification after schema changes

After changing the schema or data APIs:

1. run `npx convex dev --once --typecheck disable` or the appropriate deploy command
2. confirm indexes compile
3. run `npm run lint`
4. run `npm run typecheck`
5. run `npm run build`
6. manually test at least one authorized and one unauthorized path
