import { NextResponse } from "next/server";
import { syncNotionGoalsAndTasks } from "@/lib/db";
import { fetchGoalsAndTasks } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const items = await fetchGoalsAndTasks();
    const result = await syncNotionGoalsAndTasks(items);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
