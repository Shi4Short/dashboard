# 747 — Daily Manifest

Next.js port of the daily-manifest prototype: Dashboard / Today / Week / Month / Quarter / Evidence tabs, backed by
Postgres instead of browser localStorage so it syncs across devices.

## Local setup

```bash
npm install
```

The app reads/writes through Vercel Postgres via `@vercel/postgres`. To run it locally against a real database:

1. In the Vercel dashboard, attach a Postgres store to this project (Storage → Create Database → Postgres).
2. Pull the env vars it injects: `vercel env pull .env.local` (or copy them manually into `.env.local` — see
   `.env.local.example` for the expected keys).
3. `npm run dev` and open http://localhost:3000. On first load the app seeds itself with the starter demo data
   (matching the original prototype's seed set) and won't re-seed after that.

Without a database configured, the API routes under `app/api/*` will error — there's no localStorage fallback by
design (see the build brief's non-goals).

## Structure

- `app/api/*` — route handlers for tasks, deals, projects, milestones, subs, pitch log, week goals, evidence log,
  and settings
- `lib/db.ts` — schema (`CREATE TABLE IF NOT EXISTS`) + row mappers
- `lib/useManifestState.ts` — client hook: fetches `/api/state` once, exposes optimistic mutation actions
- `components/*Tab.tsx` — one component per tab, matching the original prototype's layout and copy

Tasks carry a `pushCount` (incremented each time a task is pushed to the next day, shown as a `↻N` badge) and an
optional `goalId` linking them to a week goal. Week goals are anchored to `weekStart` (the Sunday of that week);
deleting a goal unlinks its tasks rather than deleting them (`goal_id` is `ON DELETE SET NULL`).

## What's not here yet

Google Calendar, Notion, Gmail, and PayPal integrations are intentionally out of scope for this pass — see
the build brief. This is the plain CRUD version deployed first, integrations layer on top of it next.
