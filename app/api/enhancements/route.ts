import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import {
  EnhancementPoint,
  ENHANCEMENT_CATEGORIES,
  ADOPTION_TIERS,
  ENHANCEMENT_STATUSES,
  ENHANCEMENT_SOURCES,
} from "@/models/enhancement-point";
import { EnhancementSheet } from "@/models/enhancement-sheet";

export async function GET(request: Request) {
  await connectToDatabase();
  const { searchParams } = new URL(request.url);

  const filter: Record<string, unknown> = {};
  const category = searchParams.get("category");
  const adoptionTier = searchParams.get("adoptionTier");
  const status = searchParams.get("status");
  const source = searchParams.get("source");

  if (source) {
    if (!ENHANCEMENT_SOURCES.includes(source as (typeof ENHANCEMENT_SOURCES)[number])) {
      return NextResponse.json({ error: `source must be one of: ${ENHANCEMENT_SOURCES.join(", ")}` }, { status: 400 });
    }
    filter.source = source;
  }
  if (category) {
    if (!ENHANCEMENT_CATEGORIES.includes(category as (typeof ENHANCEMENT_CATEGORIES)[number])) {
      return NextResponse.json(
        { error: `category must be one of: ${ENHANCEMENT_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }
    filter.category = category;
  }
  if (adoptionTier) {
    if (!ADOPTION_TIERS.includes(adoptionTier as (typeof ADOPTION_TIERS)[number])) {
      return NextResponse.json({ error: `adoptionTier must be one of: ${ADOPTION_TIERS.join(", ")}` }, { status: 400 });
    }
    filter.adoptionTier = adoptionTier;
  }
  if (status) {
    if (!ENHANCEMENT_STATUSES.includes(status as (typeof ENHANCEMENT_STATUSES)[number])) {
      return NextResponse.json({ error: `status must be one of: ${ENHANCEMENT_STATUSES.join(", ")}` }, { status: 400 });
    }
    filter.status = status;
  }

  // Most-adopted first: that ordering is the whole point of the page.
  const [points, sheet] = await Promise.all([
    EnhancementPoint.find(filter).sort({ themeCount: -1, pointId: 1 }).lean(),
    EnhancementSheet.findOne().select("googleSheetUrl").lean(),
  ]);
  return NextResponse.json({ points, googleSheetUrl: sheet?.googleSheetUrl ?? null });
}

/** Per-point triage (backlog/planned/implemented/dismissed) plus a free-text note. */
export async function PATCH(request: Request) {
  await connectToDatabase();

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }

  const { pointId, status, notes } = (body ?? {}) as { pointId?: string; status?: string; notes?: string | null };

  if (!pointId || typeof pointId !== "string") {
    return NextResponse.json({ error: "pointId is required" }, { status: 400 });
  }
  if (status !== undefined && !ENHANCEMENT_STATUSES.includes(status as (typeof ENHANCEMENT_STATUSES)[number])) {
    return NextResponse.json({ error: `status must be one of: ${ENHANCEMENT_STATUSES.join(", ")}` }, { status: 400 });
  }
  if (status === undefined && notes === undefined) {
    return NextResponse.json({ error: "Provide status and/or notes" }, { status: 400 });
  }

  const update: Record<string, unknown> = {};
  if (status !== undefined) update.status = status;
  if (notes !== undefined) update.notes = notes === "" ? null : notes;

  const point = await EnhancementPoint.findOneAndUpdate({ pointId }, { $set: update }, { returnDocument: "after" }).lean();
  if (!point) {
    return NextResponse.json({ error: `No enhancement point with pointId "${pointId}"` }, { status: 404 });
  }

  return NextResponse.json({ point });
}
