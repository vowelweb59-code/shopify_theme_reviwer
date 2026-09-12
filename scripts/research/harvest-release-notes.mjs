// One-off research harvester (not part of the app runtime).
//
// Walks the public Shopify Theme Store listing to collect every theme's
// slug + preset, then pulls each theme's full release-note history from the
// store's own version-details endpoint. Output is raw structured JSON, one
// file per theme, so the aggregation step (aggregate-release-notes.mjs) can
// be re-run without re-fetching ~1,300 pages.
//
// The endpoint is a Hotwire Turbo Stream partial: it only returns the modal
// body when asked for `text/vnd.turbo-stream.html`, and the payload is wrapped
// in a <template>. Both quirks are handled below.
//
// Usage: node scripts/research/harvest-release-notes.mjs [--slugs-only]

import { mkdir, writeFile, readFile, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const OUT_DIR = ".scratch/release-notes";
const SLUG_FILE = ".scratch/theme-slugs.json";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";
const CONCURRENCY = 8;

async function get(url, accept = "text/html") {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { headers: { "user-agent": UA, accept } });
      if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
      if (!res.ok) return { status: res.status, body: null };
      return { status: res.status, body: await res.text() };
    } catch (err) {
      if (attempt === 3) return { status: 0, body: null, error: String(err) };
      await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
    }
  }
}

// ---------- step 1: every theme slug + one preset ----------

async function collectSlugs() {
  const found = new Map(); // slug -> preset
  let page = 1;
  let emptyPages = 0;

  while (page <= 80 && emptyPages < 2) {
    const { body } = await get(`https://themes.shopify.com/themes?page=${page}`);
    if (!body) {
      emptyPages++;
      page++;
      continue;
    }
    const before = found.size;
    for (const m of body.matchAll(/\/themes\/([a-z0-9][a-z0-9-]*)\/presets\/([a-z0-9][a-z0-9-]*)/g)) {
      if (!found.has(m[1])) found.set(m[1], m[2]);
    }
    const added = found.size - before;
    console.log(`page ${page}: +${added} new (total ${found.size})`);
    if (added === 0) emptyPages++;
    else emptyPages = 0;
    page++;
  }

  const list = [...found].map(([slug, preset]) => ({ slug, preset })).sort((a, b) => a.slug.localeCompare(b.slug));
  await mkdir(".scratch", { recursive: true });
  await writeFile(SLUG_FILE, JSON.stringify(list, null, 2));
  console.log(`\ncollected ${list.length} themes -> ${SLUG_FILE}`);
  return list;
}

// ---------- step 2: parse one theme's release-note history ----------

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

function parseVersions(html) {
  const versions = [];
  // Each version is one <details> block: a summary carrying "Version x.y.z"
  // plus a date, and a body div holding <h3>change type</h3><ul><li>note</li>.
  const blocks = html.split(/<details\b/).slice(1);

  for (const block of blocks) {
    const ver = block.match(/<h3[^>]*>\s*Version\s*([^<]+?)\s*<\/h3>/i);
    const date = block.match(/<p[^>]*tw-text-fg-tertiary[^>]*>\s*([^<]+?)\s*<\/p>/i);
    const bodyMatch = block.match(/<div class="tw-release-note-body">([\s\S]*?)<\/div>/i);
    if (!ver) continue;

    const changes = [];
    if (bodyMatch) {
      const body = bodyMatch[1];
      // Walk h3 headings and the list items that follow each one.
      const parts = body.split(/<h3[^>]*>/i);
      for (const part of parts.slice(1)) {
        const headEnd = part.indexOf("</h3>");
        if (headEnd === -1) continue;
        const type = decode(part.slice(0, headEnd)) || "Other";
        for (const li of part.slice(headEnd).matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
          const text = decode(li[1]);
          if (text) changes.push({ type, text });
        }
      }
      // Some designers write release notes as bare paragraphs, no headings.
      if (changes.length === 0) {
        for (const li of body.matchAll(/<li>([\s\S]*?)<\/li>/gi)) {
          const text = decode(li[1]);
          if (text) changes.push({ type: "Other", text });
        }
      }
      if (changes.length === 0) {
        for (const p of body.matchAll(/<p>([\s\S]*?)<\/p>/gi)) {
          const text = decode(p[1]);
          if (text) changes.push({ type: "Other", text });
        }
      }
    }

    versions.push({
      version: decode(ver[1]),
      date: date ? decode(date[1]) : null,
      changes,
    });
  }
  return versions;
}

async function harvestTheme({ slug, preset }) {
  const outPath = path.join(OUT_DIR, `${slug}.json`);
  if (existsSync(outPath)) return { slug, skipped: true };

  const url = `https://themes.shopify.com/themes/${slug}/presets/${preset}/modal_version_details`;
  const { status, body } = await get(url, "text/vnd.turbo-stream.html, text/html");
  if (!body) {
    await writeFile(outPath, JSON.stringify({ slug, preset, status, versions: [] }, null, 2));
    return { slug, status, versions: 0 };
  }

  const tpl = body.match(/<template[^>]*>([\s\S]*)<\/template>/i);
  const versions = parseVersions(tpl ? tpl[1] : body);
  await writeFile(outPath, JSON.stringify({ slug, preset, status, versions }, null, 2));
  return { slug, status, versions: versions.length };
}

// ---------- driver ----------

const slugsOnly = process.argv.includes("--slugs-only");

let themes;
if (existsSync(SLUG_FILE)) {
  themes = JSON.parse(await readFile(SLUG_FILE, "utf8"));
  console.log(`reusing ${themes.length} slugs from ${SLUG_FILE}`);
} else {
  themes = await collectSlugs();
}
if (slugsOnly) process.exit(0);

await mkdir(OUT_DIR, { recursive: true });

let done = 0;
let noteCount = 0;
const queue = [...themes];
async function worker() {
  while (queue.length) {
    const t = queue.shift();
    const r = await harvestTheme(t);
    done++;
    if (r.versions) noteCount += r.versions;
    if (done % 50 === 0) console.log(`${done}/${themes.length} themes (${noteCount} versions parsed)`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

const files = await readdir(OUT_DIR);
console.log(`\nDONE: ${files.length} theme files in ${OUT_DIR}, ${noteCount} versions parsed this run`);
