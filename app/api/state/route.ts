import { NextResponse } from "next/server";
import {
  rowToDeal,
  rowToFinanceEntry,
  rowToLogEntry,
  rowToMilestone,
  rowToProject,
  rowToSub,
  rowToTask,
  rowToWeekGoal,
  seedIfNeeded,
  sql,
} from "@/lib/db";
import type { AppState, MilestoneTrack } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  await seedIfNeeded();

  const [tasks, deals, projects, milestones, subs, financeEntries, pitchLog, log, weekGoals, q3goals] =
    await Promise.all([
      sql`SELECT * FROM tasks ORDER BY date, time`,
      sql`SELECT * FROM deals ORDER BY date DESC, created_at DESC`,
      sql`SELECT * FROM projects ORDER BY created_at`,
      sql`SELECT * FROM milestones ORDER BY created_at`,
      sql`SELECT * FROM subs ORDER BY created_at`,
      sql`SELECT * FROM finance_entries ORDER BY date DESC`,
      sql`SELECT * FROM pitch_log`,
      sql`SELECT * FROM log_entries ORDER BY created_at DESC`,
      sql`SELECT * FROM week_goals ORDER BY created_at`,
      sql`SELECT value FROM settings WHERE key = 'q3goals'`,
    ]);

  const milestonesByTrack: Record<MilestoneTrack, ReturnType<typeof rowToMilestone>[]> = {
    weavy: [],
    webflow: [],
  };
  for (const row of milestones) {
    const m = rowToMilestone(row);
    milestonesByTrack[m.track].push(m);
  }

  const pitchLogMap: Record<string, number> = {};
  for (const row of pitchLog) {
    pitchLogMap[row.date as string] = Number(row.count);
  }

  const state: AppState = {
    tasks: tasks.map(rowToTask),
    deals: deals.map(rowToDeal),
    projects: projects.map(rowToProject),
    milestones: milestonesByTrack,
    subs: subs.map(rowToSub),
    financeEntries: financeEntries.map(rowToFinanceEntry),
    pitchLog: pitchLogMap,
    log: log.map(rowToLogEntry),
    weekGoals: weekGoals.map(rowToWeekGoal),
    q3goals: q3goals[0]?.value ?? "",
  };

  return NextResponse.json(state);
}
