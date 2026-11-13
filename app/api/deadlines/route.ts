import { NextResponse } from "next/server";
import { loadDeadlines } from "@/lib/projects/loadDeadlines";

/** Every project with its deadline state, budget and extra days (lib/projects/loadDeadlines.ts). */
export async function GET() {
  return NextResponse.json(await loadDeadlines());
}
