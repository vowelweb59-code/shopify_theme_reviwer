import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { DATE_RANGE_PRESETS, DateRangeError, type DateRangePreset } from "@/lib/analytics/engine/dateRanges";
import { fetchInstallEvents } from "@/lib/analytics/installEvents";

// GET /api/analytics/installs?theme=<slug|all>&range=<preset>&start=&end= — the theme-install event with the details it carries
// (store URL, store title: the property's registered event parameters), read live from GA4, one group per GA4 property.
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const range = q.get("range");
  const preset = range && (DATE_RANGE_PRESETS as readonly string[]).includes(range) ? (range as DateRangePreset) : "last30";
  try {
    await connectToDatabase();
    const groups = await fetchInstallEvents(q.get("theme") || "all", { preset, start: q.get("start") ?? undefined, end: q.get("end") ?? undefined });
    return NextResponse.json({ groups });
  } catch (err) {
    if (err instanceof DateRangeError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[analytics] install events failed:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't read the install events." }, { status: 500 });
  }
}
