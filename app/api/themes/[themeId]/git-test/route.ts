import { NextResponse } from "next/server";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { testGitSource } from "@/lib/themes/gitSource";

/**
 * "Test connection" for a theme's Code source card: checks the URL and branch typed in the form (saved or not) against GitHub
 * with the server's GIT_ACCESS_TOKEN, and reports git's real error. Reads only; nothing is stored. Body: { url, branch? }.
 */
export async function POST(request: Request, { params }: { params: Promise<{ themeId: string }> }) {
  const { themeId } = await params;
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");
  const body = (await request.json().catch(() => null)) as { url?: unknown; branch?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const branch = typeof body?.branch === "string" && body.branch.trim() ? body.branch.trim() : null;
  if (!url) return NextResponse.json({ error: "Enter a repository URL first." }, { status: 400 });
  if (branch && !/^[\w./-]+$/.test(branch)) return NextResponse.json({ error: "The branch name has characters a branch can't have." }, { status: 400 });
  return NextResponse.json(await testGitSource(url, branch));
}
