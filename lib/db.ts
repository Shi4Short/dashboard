import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type { Deal, FinanceEntry, LogEntry, Milestone, Project, Sub, Task, WeekGoal } from "./types";
import { randomUUID } from "crypto";
import { addDays, todayStr } from "./utils";

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
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
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
  };
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
