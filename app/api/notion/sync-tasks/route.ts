import { NextResponse } from "next/server";
import { getNotionLinkedDoneIds, syncNotionGoalsAndTasks } from "@/lib/db";
import { fetchGoalsAndTasks, markGoalTaskDone } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    // Push first: mark anything done locally as Done in Notion. Best-effort
    // per item — one failed page update (e.g. a page since deleted in
    // Notion) shouldn't block the rest of the push or the pull that follows.
    const doneIds = await getNotionLinkedDoneIds();
    const pushResults = await Promise.allSettled(doneIds.map((id) => markGoalTaskDone(id)));
    const pushed = pushResults.filter((r) => r.status === "fulfilled").length;

    const items = await fetchGoalsAndTasks();
    const result = await syncNotionGoalsAndTasks(items);
    return NextResponse.json({ ...result, pushed });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
