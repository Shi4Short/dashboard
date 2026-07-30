# 747 — Daily Manifest

Next.js port of the daily-manifest prototype: Dashboard / Today / Week / Month / Quarter / Evidence tabs, backed by
Postgres instead of browser localStorage so it syncs across devices.

## Local setup

```bash
npm install
```

The app reads/writes through Vercel's Postgres storage (Neon-backed) via `@neondatabase/serverless` — Neon's own
driver, not `@vercel/postgres` (that package expects a pooled connection string in a shape this storage type
doesn't provide; it throws `invalid_connection_string` against it). To run it locally against a real database:

1. In the Vercel dashboard, attach a Postgres store to this project (Storage → Create Database → Postgres).
2. Pull the env vars it injects: `vercel env pull .env.local --environment=production` (the `development`
   environment doesn't get them by default — see `.env.local.example` for the expected keys if setting them
   manually).
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

## Notion sync

The Dashboard's "Art Direction Networking" card is a read-only sync of the Notion database of the same name
(`lib/notion.ts`, `app/api/notion/networking/route.ts`). It needs its own credential, separate from Postgres:

1. Create an internal integration at [notion.so/my-integrations](https://www.notion.so/my-integrations) with only
   "Read content" enabled.
2. Share the database with it: database "···" menu → Connections → add the integration.
3. Set `NOTION_TOKEN` in Vercel (Settings → Environment Variables). `NOTION_NETWORKING_DATABASE_ID` only needs
   setting if syncing a different database — it defaults to the one from the build brief.

Without `NOTION_TOKEN` set, the card shows "Not connected" instead of breaking the rest of the dashboard — unlike
Postgres, this integration is optional per the build brief.

## What's not here yet

Google Calendar, Gmail, and PayPal integrations are intentionally out of scope for this pass — see the build
brief. Notion is wired up read-only; writing back to Notion is explicitly out of scope (the brief calls for a
review step before anything gets pushed there, which doesn't exist yet).
