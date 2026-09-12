// Turns the raw harvest (.scratch/release-notes/*.json) into a committed,
// evidence-backed dataset of capability trends: data/theme-trend-points.json.
//
// Deliberately split from the harvester so this can be re-run — after editing
// a topic regex, say — without re-fetching 335 theme pages.
//
// Every emitted point carries the numbers that justify it (how many distinct
// themes ship the capability, when it first and last appeared in a release)
// plus verbatim sample notes, so a reviewer can check the claim rather than
// taking the aggregation on trust.
//
// Usage: node scripts/research/aggregate-release-notes.mjs

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { TOPICS } from "./topics.mjs";

const RAW_DIR = ".scratch/release-notes";
const OUT = "data/theme-trend-points.json";

// "Added"-family headings mean the designer shipped a new capability;
// everything else is mostly per-theme bug fixing. Both are counted, but
// only the added-family count is used to date a capability's adoption.
const ADDED_HEADING = /^(added|new|features?|new features?|feature|changed|changes|updated|improvements?|improved)$/i;

const themes = [];
for (const file of readdirSync(RAW_DIR)) {
  const doc = JSON.parse(readFileSync(`${RAW_DIR}/${file}`, "utf8"));
  const notes = [];
  for (const v of doc.versions) {
    const when = v.date ? Date.parse(v.date.replace(/\s+/g, " ")) : NaN;
    for (const c of v.changes) {
      notes.push({
        text: c.text,
        type: c.type,
        isAdded: ADDED_HEADING.test(c.type.replace(/:$/, "").trim()),
        version: v.version,
        date: Number.isNaN(when) ? null : when,
      });
    }
  }
  themes.push({ slug: doc.slug, notes });
}

const themeCount = themes.length;
const fmt = (ms) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));

function tier(pct) {
  if (pct >= 50) return "established";
  if (pct >= 20) return "common";
  if (pct >= 5) return "emerging";
  return "experimental";
}

const points = [];
for (const topic of TOPICS) {
  const matchingThemes = [];
  let noteCount = 0;
  let addedCount = 0;
  let first = null;
  let last = null;
  const samples = [];

  for (const t of themes) {
    const hits = t.notes.filter((n) => topic.re.test(n.text));
    if (!hits.length) continue;
    matchingThemes.push(t.slug);
    noteCount += hits.length;
    for (const h of hits) {
      if (h.isAdded) addedCount++;
      if (h.date != null) {
        if (first == null || h.date < first) first = h.date;
        if (last == null || h.date > last) last = h.date;
      }
    }
    // One representative note per theme. Picking the *longest* note looks
    // appealing but reliably surfaces the worst evidence: some designers
    // cram an entire release into a single bullet, so the longest match is
    // a 2,000-character changelog blob that happens to contain the keyword.
    // Score for a note that reads as one clear capability statement instead:
    // "Added"-family headings first, then length nearest ~180 characters.
    const score = (h) => (h.isAdded ? 0 : 10_000) + Math.abs(h.text.length - 180);
    const best = hits.slice().sort((a, b) => score(a) - score(b))[0];
    samples.push({ theme: t.slug, note: best.text, version: best.version, date: fmt(best.date) });
  }

  const pct = +((100 * matchingThemes.length) / themeCount).toFixed(1);
  points.push({
    pointId: topic.id,
    name: topic.name,
    category: topic.category,
    adoption: {
      themeCount: matchingThemes.length,
      themeTotal: themeCount,
      percentage: pct,
      tier: tier(pct),
      noteCount,
      addedNoteCount: addedCount,
      firstSeen: fmt(first),
      lastSeen: fmt(last),
    },
    // Same "nearest ~180 chars" preference across themes, so the four shown
    // as evidence are readable statements rather than concatenated changelogs.
    examples: samples
      .slice()
      .sort((a, b) => Math.abs(a.note.length - 180) - Math.abs(b.note.length - 180))
      .slice(0, 4),
    themes: matchingThemes.sort(),
  });
}

points.sort((a, b) => b.adoption.themeCount - a.adoption.themeCount);

const payload = {
  generatedAt: new Date().toISOString(),
  source: {
    name: "Shopify Theme Store release notes",
    url: "https://themes.shopify.com/themes",
    themesAnalyzed: themeCount,
    versionsAnalyzed: themes.reduce((a, t) => a + new Set(t.notes.map((n) => n.version)).size, 0),
    notesAnalyzed: themes.reduce((a, t) => a + t.notes.length, 0),
  },
  points,
};

mkdirSync("data", { recursive: true });
writeFileSync(OUT, JSON.stringify(payload, null, 2));

console.log(`${points.length} points -> ${OUT}`);
console.log(`(${payload.source.themesAnalyzed} themes, ${payload.source.notesAnalyzed} notes)\n`);
const byTier = {};
for (const p of points) (byTier[p.adoption.tier] ??= []).push(p);
for (const t of ["established", "common", "emerging", "experimental"]) {
  const list = byTier[t] ?? [];
  console.log(`${t} (${list.length}):`);
  for (const p of list) {
    console.log(
      `  ${String(p.adoption.percentage).padStart(5)}%  ${String(p.adoption.themeCount).padStart(3)} themes  ` +
        `${p.adoption.firstSeen ?? "?"} -> ${p.adoption.lastSeen ?? "?"}  ${p.name}`
    );
  }
}
