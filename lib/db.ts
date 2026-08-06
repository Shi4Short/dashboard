import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  Deal,
  FinanceEntry,
  LogEntry,
  NotionGoalTask,
  Project,
  ProjectMilestone,
  ProjectResource,
  Sub,
  Task,
  WeekGoal,
} from "./types";
import type { CalendarEvent } from "./google-calendar";
import { randomUUID } from "crypto";
import { addDays, todayStr, weekStartForDate } from "./utils";

// Lazily created so importing this module never throws when the env var is
// unset (e.g. during `next build`, which loads route modules without a DB
// attached). The connection string works whether it's Vercel Postgres's
// pooled or unpooled form — Neon's HTTP driver doesn't care.
let cachedSql: NeonQueryFunction<false, false> | undefined;

export function sql(strings: TemplateStringsArray, ...values: unknown[]) {
  if (!cachedSql) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("POSTGRES_URL (or DATABASE_URL) environment variable is not set");
    }
    cachedSql = neon(connectionString);
  }
  return cachedSql(strings, ...values);
}

let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`CREATE TABLE IF NOT EXISTS week_goals (
        id text PRIMARY KEY,
        text text NOT NULL,
        week_start text NOT NULL,
        done boolean NOT NULL DEFAULT false,
        notion_page_id text UNIQUE,
        notion_done boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS tasks (
        id text PRIMARY KEY,
        title text NOT NULL,
        category text NOT NULL,
        date text NOT NULL,
        time text NOT NULL DEFAULT '',
        done boolean NOT NULL DEFAULT false,
        from_calendar boolean NOT NULL DEFAULT false,
        push_count integer NOT NULL DEFAULT 0,
        goal_id text REFERENCES week_goals(id) ON DELETE SET NULL,
        notion_page_id text UNIQUE,
        notion_done boolean NOT NULL DEFAULT false,
        google_event_id text UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      // CREATE TABLE IF NOT EXISTS is a no-op on tables that already exist in
      // production, so columns added after the tables' first deploy need an
      // explicit additive migration here too, or they silently never show up
      // on the real database no matter how many times this function runs.
      await sql`ALTER TABLE week_goals ADD COLUMN IF NOT EXISTS notion_page_id text UNIQUE`;
      await sql`ALTER TABLE week_goals ADD COLUMN IF NOT EXISTS notion_done boolean NOT NULL DEFAULT false`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS push_count integer NOT NULL DEFAULT 0`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS goal_id text REFERENCES week_goals(id) ON DELETE SET NULL`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notion_page_id text UNIQUE`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS notion_done boolean NOT NULL DEFAULT false`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS google_event_id text UNIQUE`;

      await sql`CREATE TABLE IF NOT EXISTS deals (
        id text PRIMARY KEY,
        brand text NOT NULL,
        stage text NOT NULL,
        date text NOT NULL,
        notes text NOT NULL DEFAULT '',
        value numeric NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS projects (
        id text PRIMARY KEY,
        name text NOT NULL,
        type text NOT NULL,
        status text NOT NULL,
        notes text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS project_milestones (
        id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        title text NOT NULL,
        done boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS project_resources (
        id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
        label text NOT NULL,
        url text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      // Only safe to add now that projects/project_milestones exist — tasks
      // is created earlier in this function, so these can't be inline there.
      // project_id is a general "belongs to this project" link (e.g. set by
      // the Notion Project tag on import, before a task's been sorted into a
      // specific milestone); project_milestone_id is the specific link once
      // it has been.
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_id text REFERENCES projects(id) ON DELETE SET NULL`;
      await sql`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS project_milestone_id text REFERENCES project_milestones(id) ON DELETE SET NULL`;
      await sql`CREATE TABLE IF NOT EXISTS subs (
        id text PRIMARY KEY,
        name text NOT NULL,
        amount numeric NOT NULL DEFAULT 0,
        renew_date text NOT NULL DEFAULT '',
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS finance_entries (
        id text PRIMARY KEY,
        type text NOT NULL,
        amount numeric NOT NULL DEFAULT 0,
        note text NOT NULL DEFAULT '',
        date text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS pitch_log (
        date text PRIMARY KEY,
        count integer NOT NULL DEFAULT 0
      )`;
      await sql`CREATE TABLE IF NOT EXISTS log_entries (
        id text PRIMARY KEY,
        date text NOT NULL,
        text text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      // Links a task-completion entry back to the task that generated it, so
      // its displayed date can track that task's current date (see
      // /api/state) instead of freezing at whatever date the task happened
      // to have the moment it was checked off. `date` remains the fallback
      // once the task is deleted, and is still what manual/EOD entries use.
      await sql`ALTER TABLE log_entries ADD COLUMN IF NOT EXISTS task_id text REFERENCES tasks(id) ON DELETE SET NULL`;
      await sql`CREATE TABLE IF NOT EXISTS settings (
        key text PRIMARY KEY,
        value text NOT NULL DEFAULT ''
      )`;
    })();
  }
  return schemaReady;
}

export function rowToTask(r: Record<string, unknown>): Task {
  return {
    id: r.id as string,
    title: r.title as string,
    category: r.category as Task["category"],
    date: r.date as string,
    time: r.time as string,
    done: r.done as boolean,
    fromCalendar: r.from_calendar as boolean,
    fromNotion: r.notion_page_id != null,
    pushCount: Number(r.push_count),
    goalId: (r.goal_id as string | null) ?? null,
    projectId: (r.project_id as string | null) ?? null,
    projectMilestoneId: (r.project_milestone_id as string | null) ?? null,
  };
}

export function rowToDeal(r: Record<string, unknown>): Deal {
  return {
    id: r.id as string,
    brand: r.brand as string,
    stage: r.stage as Deal["stage"],
    date: r.date as string,
    notes: r.notes as string,
    value: Number(r.value),
  };
}

export function rowToProject(r: Record<string, unknown>): Project {
  return {
    id: r.id as string,
    name: r.name as string,
    type: r.type as Project["type"],
    status: r.status as Project["status"],
    notes: r.notes as string,
  };
}

export function rowToProjectMilestone(r: Record<string, unknown>): ProjectMilestone {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    title: r.title as string,
    done: r.done as boolean,
  };
}

export function rowToProjectResource(r: Record<string, unknown>): ProjectResource {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    label: r.label as string,
    url: r.url as string,
  };
}

export function rowToSub(r: Record<string, unknown>): Sub {
  return {
    id: r.id as string,
    name: r.name as string,
    amount: Number(r.amount),
    renewDate: r.renew_date as string,
  };
}

export function rowToFinanceEntry(r: Record<string, unknown>): FinanceEntry {
  return {
    id: r.id as string,
    type: r.type as FinanceEntry["type"],
    amount: Number(r.amount),
    note: r.note as string,
    date: r.date as string,
  };
}

export function rowToLogEntry(r: Record<string, unknown>): LogEntry {
  return {
    id: r.id as string,
    date: r.date as string,
    text: r.text as string,
    taskId: (r.task_id as string | null) ?? null,
  };
}

export function rowToWeekGoal(r: Record<string, unknown>): WeekGoal {
  return {
    id: r.id as string,
    text: r.text as string,
    weekStart: r.week_start as string,
    done: r.done as boolean,
    fromNotion: r.notion_page_id != null,
  };
}

export async function getSetting(key: string): Promise<string | null> {
  await ensureSchema();
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length ? (rows[0].value as string) : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureSchema();
  await sql`INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

/**
 * Called by the PATCH routes whenever a task/goal/milestone/project genuinely
 * transitions to done (never on a no-op re-save of an already-done item),
 * so every completion shows up in the Evidence log without needing the
 * end-of-day "Add evidence" step. Lives here rather than in a client hook so
 * it fires no matter what calls the API — the dashboard UI, a direct API
 * call, a future integration.
 */
export async function logCompletion(text: string, date: string = todayStr(), taskId: string | null = null): Promise<void> {
  if (!text.trim()) return;
  await sql`INSERT INTO log_entries (id, date, text, task_id) VALUES (${randomUUID()}, ${date}, ${text}, ${taskId})`;
}

/**
 * Called after a task linked to a project milestone is marked done. Cascades
 * two levels:
 *  1. If every task under that milestone is now done, the milestone
 *     auto-completes (this is what fills its segment on the project's
 *     progress bar to 100%).
 *  2. If that just completed the last remaining milestone on the project,
 *     the project auto-completes too.
 * Both steps log to Evidence the same way a manual done-toggle does, and
 * both are no-ops if already done, so nothing double-logs.
 */
export async function checkMilestoneAutoComplete(projectMilestoneId: string, date: string = todayStr()): Promise<void> {
  const [{ total, remaining }] = await sql`
    SELECT count(*) AS total, count(*) FILTER (WHERE NOT done) AS remaining
    FROM tasks WHERE project_milestone_id = ${projectMilestoneId}
  `;
  if (Number(total) === 0 || Number(remaining) > 0) return;

  const [milestone] = await sql`SELECT project_id, title, done FROM project_milestones WHERE id = ${projectMilestoneId}`;
  if (!milestone || milestone.done) return;

  await sql`UPDATE project_milestones SET done = true WHERE id = ${projectMilestoneId}`;
  await logCompletion(`Milestone complete: ${milestone.title}`, date);
  await checkProjectMilestonesComplete(milestone.project_id as string, date);
}

/**
 * The second half of the cascade, also usable on its own for a milestone
 * marked done directly (not via its tasks all finishing) — same "all
 * milestones done -> project auto-completes" rule either way.
 */
export async function checkProjectMilestonesComplete(projectId: string, date: string = todayStr()): Promise<void> {
  const [{ total, remaining }] = await sql`
    SELECT count(*) AS total, count(*) FILTER (WHERE NOT done) AS remaining
    FROM project_milestones WHERE project_id = ${projectId}
  `;
  if (Number(total) === 0 || Number(remaining) > 0) return;

  const [project] = await sql`SELECT status, name FROM projects WHERE id = ${projectId}`;
  if (!project || project.status === "done") return;

  await sql`UPDATE projects SET status = 'done' WHERE id = ${projectId}`;
  await logCompletion(`Completed: ${project.name}`, date);
}

/**
 * Mirrors the prototype's one-time demo seed (calendar-style tasks + starter
 * deals/portfolio checklist). Runs exactly once, gated by a `settings.seeded`
 * flag, so it doesn't reappear on every load like the original localStorage version did.
 */
export async function seedIfNeeded(): Promise<void> {
  await ensureSchema();
  const rows = await sql`SELECT value FROM settings WHERE key = 'seeded'`;
  if (rows.length) return;

  const t0 = todayStr();
  const seedTasks: Array<{ title: string; date: string; time: string; category: Task["category"] }> = [
    { title: "Filming Content", date: t0, time: "10:00", category: "content" },
    { title: "Campaign & Visual Systems Research (YouTube)", date: t0, time: "14:00", category: "learning" },
    { title: "Outreach: Art Directors & Connections", date: t0, time: "16:00", category: "design" },
    { title: "Set up PayPal Account", date: t0, time: "18:00", category: "personal" },
    { title: "Apply for UGC deals on Cohley", date: t0, time: "18:30", category: "ugc" },
    { title: "Film: Mana and Omnipemf (2 videos)", date: addDays(t0, 1), time: "10:00", category: "content" },
    { title: "Film/Edit: Fashion Content", date: addDays(t0, 2), time: "10:00", category: "content" },
    { title: "Art Direction Study: Lighting focus", date: addDays(t0, 3), time: "11:00", category: "design" },
    { title: "Art Direction Study: Lighting focus", date: addDays(t0, 4), time: "11:00", category: "design" },
    { title: "Finish Portfolio/Template Goal", date: addDays(t0, 6), time: "", category: "design" },
  ];
  for (const s of seedTasks) {
    await sql`INSERT INTO tasks (id, title, category, date, time, done, from_calendar)
      VALUES (${randomUUID()}, ${s.title}, ${s.category}, ${s.date}, ${s.time}, false, true)`;
  }

  const seedDeals: Array<{ brand: string; value: number }> = [
    { brand: "Chime", value: 800 },
    { brand: "Moonsleep", value: 0 },
    { brand: "Omnilux", value: 0 },
  ];
  let pitchCount = 0;
  for (const d of seedDeals) {
    await sql`INSERT INTO deals (id, brand, stage, date, notes, value)
      VALUES (${randomUUID()}, ${d.brand}, 'outbound', ${t0}, '', ${d.value})`;
    pitchCount++;
  }
  await sql`INSERT INTO pitch_log (date, count) VALUES (${t0}, ${pitchCount})
    ON CONFLICT (date) DO UPDATE SET count = pitch_log.count + EXCLUDED.count`;

  const portfolioTasks = [
    "Outreach to Art Directors (ADPList/LinkedIn) to define portfolio visual-system requirements",
    "Study visual system fundamentals",
    "Analyze 3 campaigns against the framework: visual system, concept, market gap, what is/isn't working, your improvements",
    "Turn findings into portfolio direction + case-study structure",
  ];
  for (const title of portfolioTasks) {
    await sql`INSERT INTO projects (id, name, type, status, notes)
      VALUES (${randomUUID()}, ${title}, 'portfolio', 'active', '')`;
  }

  await sql`INSERT INTO settings (key, value) VALUES ('seeded', 'true')
    ON CONFLICT (key) DO NOTHING`;
}

/**
 * The notion_page_id of every Notion-linked task/week_goal that's marked
 * done locally but whose Notion copy wasn't Done as of the last pull
 * (notion_done tracks that separately from the locally-editable `done`, so
 * an already-confirmed-synced item doesn't get re-pushed — Notion API calls
 * every sync click otherwise). Title/date/notes stay one-way from Notion
 * (that's actual content); done/Status is the one field allowed to flow
 * both ways, and only ever toward "done", never back toward "not done" in
 * either direction, so neither side can silently un-complete something the
 * other side already finished.
 */
export async function getNotionLinkedDoneIds(): Promise<string[]> {
  await ensureSchema();
  const [taskRows, goalRows] = await Promise.all([
    sql`SELECT notion_page_id FROM tasks WHERE done = true AND notion_done = false AND notion_page_id IS NOT NULL`,
    sql`SELECT notion_page_id FROM week_goals WHERE done = true AND notion_done = false AND notion_page_id IS NOT NULL`,
  ]);
  return [...taskRows, ...goalRows].map((r) => r.notion_page_id as string);
}

/**
 * Pulls Notion's "Goals & Tasks" database into the existing tasks/week_goals
 * tables, keyed on notion_page_id. Notion owns title/date/notes on every
 * sync; `done` only ever moves false -> true from Notion, never the reverse,
 * so checking something off locally is never clobbered by a stale
 * "Not started" still sitting in Notion. `notion_done` is a plain mirror of
 * Notion's own status (not OR'd with the local value) so the next push
 * knows what's already confirmed synced. Items without a date can't be
 * placed on the date-based Today/Week/Month grids, so they're skipped.
 *
 * Before inserting a new task, this also checks for an existing unlinked
 * task with the same title+date (most often the same real thing already
 * pulled in from Google Calendar) and attaches to it instead of creating a
 * duplicate row — same cross-source dedup as syncGoogleCalendarEvents does
 * in the other direction.
 */
export async function syncNotionGoalsAndTasks(
  items: NotionGoalTask[]
): Promise<{ tasksSynced: number; goalsSynced: number; skipped: number }> {
  await ensureSchema();
  let tasksSynced = 0;
  let goalsSynced = 0;
  let skipped = 0;

  for (const rawItem of items) {
    if (!rawItem.name.trim() || !rawItem.date) {
      skipped++;
      continue;
    }
    // Notion's Date property returns a full ISO timestamp when "include
    // time" is on for that page, instead of a plain YYYY-MM-DD like it
    // returns for date-only pages. The tasks table (and the Calendar sync
    // it cross-dedupes against) always keys on a plain date, so a mixed
    // timestamp here would both miss the cross-source dedup match and
    // never equal any Today/Week/Month view's plain date string.
    const item = { ...rawItem, name: rawItem.name.trim(), date: rawItem.date.slice(0, 10) };

    if (item.period === "Weekly") {
      const weekStart = weekStartForDate(item.date);
      await sql`
        INSERT INTO week_goals (id, text, week_start, done, notion_page_id, notion_done)
        VALUES (${randomUUID()}, ${item.name}, ${weekStart}, ${item.done}, ${item.id}, ${item.done})
        ON CONFLICT (notion_page_id) DO UPDATE
        SET text = EXCLUDED.text,
            week_start = EXCLUDED.week_start,
            done = week_goals.done OR EXCLUDED.done,
            notion_done = EXCLUDED.notion_done
      `;
      goalsSynced++;
      continue;
    }

    let projectId: string | null = null;
    if (item.projectName) {
      const [match] = await sql`
        SELECT id FROM projects WHERE lower(trim(name)) = lower(trim(${item.projectName})) LIMIT 1
      `;
      projectId = match ? (match.id as string) : null;
    }

    const [existing] = await sql`SELECT id FROM tasks WHERE notion_page_id = ${item.id}`;
    if (existing) {
      await sql`
        UPDATE tasks
        SET title = ${item.name},
            date = ${item.date},
            done = done OR ${item.done},
            notion_done = ${item.done},
            project_id = ${projectId},
            category = COALESCE(${item.category}, category)
        WHERE id = ${existing.id}
      `;
    } else {
      const [dupe] = await sql`
        SELECT id FROM tasks WHERE title = ${item.name} AND date = ${item.date} AND notion_page_id IS NULL LIMIT 1
      `;
      if (dupe) {
        await sql`
          UPDATE tasks
          SET notion_page_id = ${item.id},
              notion_done = ${item.done},
              done = done OR ${item.done},
              project_id = COALESCE(${projectId}, project_id),
              category = COALESCE(${item.category}, category)
          WHERE id = ${dupe.id}
        `;
      } else {
        await sql`
          INSERT INTO tasks (id, title, category, date, time, done, from_calendar, notion_page_id, notion_done, project_id)
          VALUES (${randomUUID()}, ${item.name}, COALESCE(${item.category}, 'personal'), ${item.date}, '', ${item.done}, false, ${item.id}, ${item.done}, ${projectId})
        `;
      }
    }
    tasksSynced++;
  }

  return { tasksSynced, goalsSynced, skipped };
}

/**
 * Pulls Google Calendar events into the same tasks table Today/Week/Month
 * already read from, keyed on google_event_id — same shape as the Notion
 * import, minus any push-back (Calendar isn't a completion tracker, so
 * there's nothing to push). `done` is left untouched on an existing row so
 * a local completion is never reset by a re-sync.
 *
 * Before inserting a new task, this checks for an existing unlinked task
 * with the same title+date (most often the same real thing already pulled
 * in from Notion) and attaches to it instead of creating a duplicate row —
 * same cross-source dedup as syncNotionGoalsAndTasks does in the other
 * direction.
 */
export async function syncGoogleCalendarEvents(
  events: CalendarEvent[]
): Promise<{ synced: number; skipped: number }> {
  await ensureSchema();
  let synced = 0;
  let skipped = 0;

  for (const event of events) {
    if (!event.title.trim() || !event.start) {
      skipped++;
      continue;
    }
    const date = event.start.slice(0, 10);
    const time = event.allDay ? "" : event.start.slice(11, 16);

    const [existing] = await sql`SELECT id, push_count FROM tasks WHERE google_event_id = ${event.id}`;
    if (existing) {
      // date/time are only ever pulled from Calendar for a task that's
      // never been manually pushed — push_count is otherwise only ever
      // incremented by pushTaskToTomorrow, so a nonzero count means the
      // user deliberately moved this off its Calendar slot. Without this
      // guard, every sync (which runs on every page load) snapped a pushed
      // Calendar task straight back to its original day, silently undoing
      // the push every time.
      if (Number(existing.push_count) > 0) {
        await sql`UPDATE tasks SET title = ${event.title} WHERE id = ${existing.id}`;
      } else {
        await sql`UPDATE tasks SET title = ${event.title}, date = ${date}, time = ${time} WHERE id = ${existing.id}`;
      }
    } else {
      const [dupe] = await sql`
        SELECT id FROM tasks WHERE title = ${event.title} AND date = ${date} AND google_event_id IS NULL LIMIT 1
      `;
      if (dupe) {
        await sql`
          UPDATE tasks SET google_event_id = ${event.id}, from_calendar = true, time = ${time} WHERE id = ${dupe.id}
        `;
      } else {
        await sql`
          INSERT INTO tasks (id, title, category, date, time, done, from_calendar, google_event_id)
          VALUES (${randomUUID()}, ${event.title}, 'personal', ${date}, ${time}, false, true, ${event.id})
        `;
      }
    }
    synced++;
  }

  return { synced, skipped };
}

/**
 * One-time cleanup for Evidence entries logged before task completions were
 * linked back to their task via task_id (see logCompletion / /api/state).
 * Backfills task_id (which is what makes an entry's displayed date track
 * its task going forward, not just correct it once) for entries whose text
 * exactly matches exactly one task's title — anything ambiguous (no match,
 * or the same title on more than one task) is left alone rather than
 * guessed at, since a wrong link here is worse than an entry that's merely
 * still unlinked.
 */
export async function reconcileEvidenceDates(): Promise<{ fixed: number; skipped: number }> {
  await ensureSchema();
  const entries = await sql`SELECT id, date, text FROM log_entries WHERE task_id IS NULL`;
  let fixed = 0;
  let skipped = 0;

  for (const entry of entries) {
    const matches = await sql`SELECT id, date FROM tasks WHERE title = ${entry.text as string}`;
    if (matches.length !== 1) {
      skipped++;
      continue;
    }
    await sql`UPDATE log_entries SET task_id = ${matches[0].id}, date = ${matches[0].date} WHERE id = ${entry.id}`;
    fixed++;
  }

  return { fixed, skipped };
}
