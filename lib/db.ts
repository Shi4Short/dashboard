import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Deal, FinanceEntry, LogEntry, Milestone, NotionGoalTask, Project, Sub, Task, WeekGoal } from "./types";
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
      await sql`CREATE TABLE IF NOT EXISTS milestones (
        id text PRIMARY KEY,
        track text NOT NULL,
        title text NOT NULL,
        done boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
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

export function rowToMilestone(r: Record<string, unknown>): Milestone {
  return {
    id: r.id as string,
    track: r.track as Milestone["track"],
    title: r.title as string,
    done: r.done as boolean,
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
export async function logCompletion(text: string): Promise<void> {
  if (!text.trim()) return;
  await sql`INSERT INTO log_entries (id, date, text) VALUES (${randomUUID()}, ${todayStr()}, ${text})`;
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
 */
export async function syncNotionGoalsAndTasks(
  items: NotionGoalTask[]
): Promise<{ tasksSynced: number; goalsSynced: number; skipped: number }> {
  await ensureSchema();
  let tasksSynced = 0;
  let goalsSynced = 0;
  let skipped = 0;

  for (const item of items) {
    if (!item.name.trim() || !item.date) {
      skipped++;
      continue;
    }

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
    } else {
      await sql`
        INSERT INTO tasks (id, title, category, date, time, done, from_calendar, notion_page_id, notion_done)
        VALUES (${randomUUID()}, ${item.name}, 'personal', ${item.date}, '', ${item.done}, false, ${item.id}, ${item.done})
        ON CONFLICT (notion_page_id) DO UPDATE
        SET title = EXCLUDED.title,
            date = EXCLUDED.date,
            done = tasks.done OR EXCLUDED.done,
            notion_done = EXCLUDED.notion_done
      `;
      tasksSynced++;
    }
  }

  return { tasksSynced, goalsSynced, skipped };
}
