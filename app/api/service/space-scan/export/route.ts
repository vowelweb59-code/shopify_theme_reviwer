import { exportSpaceText } from "@/lib/service/chat/space-scan";

export const dynamic = "force-dynamic";

// Temporary Space scan tab: downloads the whole space as threaded plain text (the login gate in proxy.ts covers this route).
export async function GET() {
  try {
    const text = await exportSpaceText();
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
