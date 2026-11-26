// Asks the live app which Chat spaces the connected account is in and which active project each looks like (name match, suggestions only).
// Read-only; uses SPACE_EXPORT_TOKEN from the env file like fetch-space.ts. Writes the full list to ~/space-scan/spaces.json.
//   npx tsx --env-file=.env.production.local scripts/match-spaces.ts [--url=https://...]
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ProjectMatch, SpaceRef } from "@/lib/service/import/space-match";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const token = process.env.SPACE_EXPORT_TOKEN?.trim();
  if (!token) throw new Error("SPACE_EXPORT_TOKEN is not in the env file.");
  const base = (arg("url") ?? process.env.LIVE_URL ?? "https://shopify-theme-reviwer.onrender.com").replace(/\/$/, "");
  const res = await fetch(`${base}/api/service/space-scan/spaces`, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5 * 60_000) });
  const body = (await res.json().catch(() => ({}))) as { error?: string; spaceCount?: number; matches?: ProjectMatch[]; spaces?: SpaceRef[] };
  if (!res.ok) throw new Error(`Request failed (${res.status}): ${body.error ?? "no detail"}`);
  const dir = join(homedir(), "space-scan");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "spaces.json"), JSON.stringify(body, null, 2), "utf8");
  console.log(`${body.spaceCount} spaces found. Full list saved to ${join(dir, "spaces.json")}\n`);
  for (const m of body.matches ?? []) {
    const c = m.candidates;
    console.log(
      `${m.project.name.padEnd(36)} ${c.length ? c.map((x) => `${x.displayName} [${x.name}] ${x.score}`).join("  |  ") : "(no space with a matching name)"}`
    );
  }
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
