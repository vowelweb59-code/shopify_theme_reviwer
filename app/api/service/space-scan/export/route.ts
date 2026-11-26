import { exportSpaceText, isLinkedSpace } from "@/lib/service/chat/space-scan";

export const dynamic = "force-dynamic";

// Temporary Space scan tab: downloads a Chat space as threaded plain text (the login gate in proxy.ts covers this route; the export token opens it too).
// No parameters = the first space (Lulu Designs), whole history. ?space=spaces/XXXX reads one space connected to a project (anything else is refused);
// ?days=90 limits it to messages of the last 90 days.
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const space = params.get("space");
  const days = Number(params.get("days") ?? "");
  try {
    if (space && !(/^spaces\/[A-Za-z0-9_-]+$/.test(space) && (await isLinkedSpace(space)))) {
      return Response.json({ error: "That space is not connected to a project." }, { status: 403 });
    }
    const text = await exportSpaceText({ space: space ?? undefined, days: Number.isInteger(days) && days > 0 && days <= 3650 ? days : null });
    return new Response(text, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "content-disposition": `attachment; filename="space-${new Date().toISOString().slice(0, 10)}.txt"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Could not read the space." }, { status: 500 });
  }
}
