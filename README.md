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

### Goals & Tasks sync (two-way on status only, manual)

The "Sync with Notion" button on the Dashboard both pulls and pushes against Notion's "Goals & Tasks" database
(Name / Date / Period: Daily-Weekly-Monthly-Quarterly / Notes / Status), keyed on `notion_page_id`:
- **Pull**: Notion rows land in the same `tasks` and `week_goals` tables the dashboard already uses — "Weekly"
  items become week goals, everything else becomes a task dated on its Notion date. Items with no date can't be
  placed on the date-based grids and are skipped (reported in the sync result).
- **Push**: any Notion-linked task/goal marked done locally gets its Notion Status flipped to Done.

The "review before it touches Notion" rule from the build brief is about *content* she's authoring (scripts,
templates, etc.) — it doesn't apply to flipping a status field on a row that already exists there, so that part
of this sync can safely be two-way. Everything else stays one-way and title/date/notes stay Notion's content, not
this app's, on every pull:
- Notion always overwrites title/date/notes on pull.
- `done`/Status only ever moves false → true, in *either* direction, never the reverse — so neither side can
  silently un-complete something the other side already finished.
- This app never creates new pages in Notion and never touches any property except Status.
- Sync only runs when you click the button, not on every page load, so a slow/down Notion API can't affect normal
  dashboard use.

Rows pulled this way carry `fromNotion: true` and render a small "📓 notion" badge (`notion_page_id` is the sync
key, stored server-side only — it's not part of the client-facing `Task`/`WeekGoal` shape). Reuses `NOTION_TOKEN`;
needs the database shared with the same integration as Networking, and — because this direction actually writes —
that integration needs "Update content" enabled too, not just "Read content" (Notion → Settings → Connections →
your integration → Capabilities). `NOTION_GOALS_TASKS_DATABASE_ID` only needs setting if syncing a different
database.

## What's not here yet

Google Calendar, Gmail, and PayPal integrations are intentionally out of scope for this pass — see the build
brief. The Networking card stays read-only; Goals & Tasks status can sync both ways (see above), but this app
still never writes actual content (titles, notes, new pages) to Notion.
