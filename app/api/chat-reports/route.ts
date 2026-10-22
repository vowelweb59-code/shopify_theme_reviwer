import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { importReports } from "@/lib/chat/importReports";
import { ChatReport } from "@/models/chat-report";

const MAX_TEXT = 200_000;

/** Reports needing a look (no matching theme or team member), newest first. */
export async function GET() {
  await connectToDatabase();
  const [total, needsReview] = await Promise.all([
    ChatReport.countDocuments(),
    ChatReport.find({ status: "needs_review" }).sort({ date: -1 }).limit(100).select("sender themeName date minutes reason").lean(),
  ]);
  return NextResponse.json({ total, needsReview });
}

/** Paste import: `text` holds one or more reports; `memberId` is who posted them. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "A JSON body is required." }, { status: 400 });
  const text = typeof body.text === "string" ? body.text : "";
  if (!text.trim()) return NextResponse.json({ error: "Paste at least one report." }, { status: 400 });
  if (text.length > MAX_TEXT) return NextResponse.json({ error: "That is too much text to import at once." }, { status: 400 });

  await connectToDatabase();
  const summary = await importReports([{ memberId: typeof body.memberId === "string" ? body.memberId : null, text }]);
  return NextResponse.json(summary);
}
