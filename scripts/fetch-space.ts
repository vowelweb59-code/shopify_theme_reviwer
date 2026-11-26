// Pulls the Space scan export (the whole Chat space as threaded text) from the live app into ONE fixed file outside the repository, so it
// can be read without any manual download (owner, 2026-11-26). Signs in with BASIC_AUTH_USER / BASIC_AUTH_PASSWORD from the env file,
// calls GET /api/service/space-scan/export on the live site and writes ~/space-scan/space-latest.txt (never committed: it holds chat text).
//   npx tsx --env-file=.env.production.local scripts/fetch-space.ts [--url=https://...] [--out=<file>]
import { mkdir, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);

async function main() {
  const base = (arg("url") ?? process.env.LIVE_URL ?? "https://shopify-theme-reviwer.onrender.com").replace(/\/$/, "");
  const out = arg("out") ?? join(homedir(), "space-scan", "space-latest.txt");
  const username = process.env.BASIC_AUTH_USER;
  const password = process.env.BASIC_AUTH_PASSWORD;
  if (!username || !password)
    throw new Error(
      "BASIC_AUTH_USER / BASIC_AUTH_PASSWORD are not in the env file; add them (the live site's sign-in) or download the file from the tab by hand."
    );

  const login = await fetch(`${base}/api/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!login.ok) throw new Error(`Sign-in failed (${login.status}).`);
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  if (!cookie) throw new Error("Sign-in gave no session cookie.");

  console.log("Reading the whole space on the live site (can take a few minutes)...");
  const res = await fetch(`${base}/api/service/space-scan/export`, { headers: { cookie }, signal: AbortSignal.timeout(15 * 60_000) });
  if (!res.ok) throw new Error(`Export failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const text = await res.text();
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
