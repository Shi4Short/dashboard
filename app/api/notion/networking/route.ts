import { NextResponse } from "next/server";
import { fetchNetworkingContacts } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const contacts = await fetchNetworkingContacts();
    return NextResponse.json({ contacts });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 503 });
  }
}
