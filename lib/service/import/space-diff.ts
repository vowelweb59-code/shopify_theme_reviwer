import { createHash } from "node:crypto";

// Finds which threads of a Chat-space export (lib/service/import/space-insights.ts `formatSpaceThreads`) are new or changed since the last
// run, so the daily Live Project Chat Summary job (scripts/space-daily.ts) only has Claude Code read what moved (owner, 2026-11-26).
// A thread is identified by its start time and first sender, not its number, so a number shift does not make everything look new.

export interface ExportThread {
  key: string;
  /** The export's own number for it, as quoted in the lists (T123). */
  number: number;
  text: string;
  hash: string;
}

export function parseExportThreads(text: string): ExportThread[] {
  const out: ExportThread[] = [];
  const seen = new Map<string, number>();
  const parts = text.split(/^(?==== THREAD )/m).filter((p) => p.startsWith("=== THREAD "));
  for (const part of parts) {
    const head = /^=== THREAD (\d+) · \d+ messages? · started ([0-9-]+ [0-9:]+) IST ===/.exec(part);
    if (!head) continue;
    const sender = /^\[[^\]]+\] ([^:\n]+):/m.exec(part)?.[1] ?? "";
    const base = `${head[2]}|${sender}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const body = part.trimEnd();
    out.push({
      key: n === 1 ? base : `${base}#${n}`,
      number: Number(head[1]),
      text: body,
      // The hash ignores the thread number line, so a renumbering alone is not a change.
      hash: createHash("sha1")
        .update(body.replace(/^=== THREAD \d+/, "=== THREAD"))
        .digest("hex"),
    });
  }
  return out;
}

export type Snapshot = Record<string, string>;

export const toSnapshot = (threads: readonly ExportThread[]): Snapshot => Object.fromEntries(threads.map((t) => [t.key, t.hash]));

/** Threads that are new or whose text (replies, edits) changed since `previous`. */
export function changedThreads(previous: Snapshot, current: readonly ExportThread[]): ExportThread[] {
  return current.filter((t) => previous[t.key] !== t.hash);
}

/** Splits threads into groups of at most `maxBytes` of text (a thread bigger than that is a group of its own), keeping their order, so a big first read
 * or a big day can be handed to Claude Code in several runs. */
export function chunkThreads(threads: readonly ExportThread[], maxBytes: number): ExportThread[][] {
  const out: ExportThread[][] = [];
  let current: ExportThread[] = [];
  let size = 0;
  for (const t of threads) {
    const n = Buffer.byteLength(t.text, "utf8");
    if (current.length && size + n > maxBytes) {
      out.push(current);
      current = [];
      size = 0;
    }
    current.push(t);
    size += n;
  }
  if (current.length) out.push(current);
  return out;
}
