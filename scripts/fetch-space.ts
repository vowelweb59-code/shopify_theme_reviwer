// Pulls the Space export (the whole Chat space as threaded text) from the live app into ONE fixed file outside the repository, so it can be
// read without any manual download (owner, 2026-11-26). Signs in with BASIC_AUTH_USER / BASIC_AUTH_PASSWORD from the env file, calls
// GET /api/service/space-scan/export on the live site and writes ~/space-scan/space-latest.txt (never committed: it holds chat text).
//   npx tsx --env-file=.env.production.local scripts/fetch-space.ts [--url=https://...] [--out=<file>]
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fetchSpaceText } from "@/lib/service/chat/space-fetch";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const out = arg("out") ?? join(homedir(), "space-scan", "space-latest.txt");
  console.log("Reading the whole space on the live site (can take a few minutes)...");
  const text = await fetchSpaceText({ base: arg("url") });
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, text, "utf8");
  console.log(`Saved ${out}: ${(text.length / 1024).toFixed(0)} KB, ${(text.match(/^=== THREAD /gm) ?? []).length} threads.`);
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
