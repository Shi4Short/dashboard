import { NextResponse } from "next/server";
import {
  rowToDeal,
  rowToFinanceEntry,
  rowToLogEntry,
  rowToProject,
  rowToProjectMilestone,
  rowToProjectResource,
  rowToSub,
  rowToTask,
  rowToWeekGoal,
  seedIfNeeded,
  sql,
} from "@/lib/db";
import type { AppState } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await seedIfNeeded();

  const [tasks, deals, projects, projectMilestones, projectResources, subs, financeEntries, pitchLog, log, weekGoals, q3goals] =
    await Promise.all([
      sql`SELECT * FROM tasks ORDER BY date, time`,
      sql`SELECT * FROM deals ORDER BY date DESC, created_at DESC`,
      sql`SELECT * FROM projects ORDER BY created_at`,
      sql`SELECT * FROM project_milestones ORDER BY created_at`,
      sql`SELECT * FROM project_resources ORDER BY created_at`,
      sql`SELECT * FROM subs ORDER BY created_at`,
      sql`SELECT * FROM finance_entries ORDER BY date DESC`,
      sql`SELECT * FROM pitch_log`,
      sql`SELECT * FROM log_entries ORDER BY created_at DESC`,
      sql`SELECT * FROM week_goals ORDER BY created_at`,
      sql`SELECT value FROM settings WHERE key = 'q3goals'`,
    ]);

  const pitchLogMap: Record<string, number> = {};
  for (const row of pitchLog) {
    pitchLogMap[row.date as string] = Number(row.count);
  }

  // A log entry linked to a task tracks that task's *current* date rather
  // than the date frozen into the row at insert time — the task can move
  // afterward (a push, a Calendar/Notion resync, a manual edit), and the
  // evidence should follow it there rather than staying stuck on whichever
  // day the checkbox happened to get hit. Entries whose task has since been
  // deleted fall back to their own stored date.
  const taskDateById = new Map(tasks.map((t) => [t.id as string, t.date as string]));
  const logEntries = log.map(rowToLogEntry).map((l) => (l.taskId && taskDateById.has(l.taskId) ? { ...l, date: taskDateById.get(l.taskId)! } : l));

  const state: AppState = {
    tasks: tasks.map(rowToTask),
    deals: deals.map(rowToDeal),
    projects: projects.map(rowToProject),
    projectMilestones: projectMilestones.map(rowToProjectMilestone),
    projectResources: projectResources.map(rowToProjectResource),
    subs: subs.map(rowToSub),
    financeEntries: financeEntries.map(rowToFinanceEntry),
    pitchLog: pitchLogMap,
    log: logEntries,
    weekGoals: weekGoals.map(rowToWeekGoal),
    q3goals: q3goals[0]?.value ?? "",
  };

  return NextResponse.json(state);
}
