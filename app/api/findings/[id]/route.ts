import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Finding, FINDING_STATUSES } from "@/models/finding";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectToDatabase();
  const { id } = await params;
  const body = await request.json().catch(() => null);

  const status = body?.status;
  if (!FINDING_STATUSES.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${FINDING_STATUSES.join(", ")}` }, { status: 400 });
  }

  const ignoredReason = typeof body?.ignoredReason === "string" ? body.ignoredReason.trim() : "";
  if (status === "ignored" && !ignoredReason) {
    return NextResponse.json({ error: "A reason is required when ignoring a finding." }, { status: 400 });
  }

  const finding = await Finding.findByIdAndUpdate(
    id,
    {
      $set: {
        status,
        ignoredReason: status === "ignored" ? ignoredReason : null,
        statusUpdatedAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  if (!finding) return NextResponse.json({ error: "Finding not found." }, { status: 404 });
  return NextResponse.json({ finding });
}
