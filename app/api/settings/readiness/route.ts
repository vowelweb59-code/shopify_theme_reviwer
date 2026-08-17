import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { ReadinessConfigModel } from "@/models/readiness-config";
import { FINDING_SEVERITIES } from "@/models/finding";
import { loadReadinessConfig } from "@/lib/audit/readinessConfigStore";

export async function GET() {
  await connectToDatabase();
  const config = await loadReadinessConfig();
  return NextResponse.json({ config });
}

export async function PATCH(request: Request) {
  await connectToDatabase();
  const body = await request.json().catch(() => null);

  const blockerSeverities = body?.blockerSeverities;
  const minimumCoveragePercent = body?.minimumCoveragePercent;

  if (!Array.isArray(blockerSeverities) || blockerSeverities.length === 0) {
    return NextResponse.json({ error: "blockerSeverities must be a non-empty array." }, { status: 400 });
  }
  if (!blockerSeverities.every((s) => FINDING_SEVERITIES.includes(s))) {
    return NextResponse.json({ error: `blockerSeverities must only contain: ${FINDING_SEVERITIES.join(", ")}` }, { status: 400 });
  }
  if (typeof minimumCoveragePercent !== "number" || minimumCoveragePercent < 0 || minimumCoveragePercent > 100) {
    return NextResponse.json({ error: "minimumCoveragePercent must be a number between 0 and 100." }, { status: 400 });
  }

  await loadReadinessConfig(); // ensures the singleton exists before we update it
  const config = await ReadinessConfigModel.findOneAndUpdate(
    {},
    { $set: { blockerSeverities, minimumCoveragePercent } },
    { new: true }
  );

  return NextResponse.json({ config });
}
