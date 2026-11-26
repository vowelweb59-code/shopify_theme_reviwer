import { describe, expect, it } from "vitest";
import { changedThreads, parseExportThreads, toSnapshot } from "./space-diff";

const t1 = "=== THREAD 1 · 1 message · started 2026-11-01 15:30 IST ===\n[2026-11-01 15:30] Asha: Please send the report\n";
const t2 = "=== THREAD 2 · 1 message · started 2026-11-02 10:00 IST ===\n[2026-11-02 10:00] Ravi: Lunch plan for Friday\n";

describe("space-diff", () => {
  it("parses threads with a stable key", () => {
    const threads = parseExportThreads(`${t1}\n${t2}`);
    expect(threads.map((t) => [t.number, t.key])).toEqual([
      [1, "2026-11-01 15:30|Asha"],
      [2, "2026-11-02 10:00|Ravi"],
    ]);
  });

  it("reports nothing when the export is unchanged, even if threads were renumbered", () => {
    const before = toSnapshot(parseExportThreads(`${t1}\n${t2}`));
    const renumbered = `${t1.replace("THREAD 1", "THREAD 5")}\n${t2.replace("THREAD 2", "THREAD 6")}`;
    expect(changedThreads(before, parseExportThreads(renumbered))).toEqual([]);
  });

  it("reports a new thread and a thread that got a reply", () => {
    const before = toSnapshot(parseExportThreads(`${t1}\n${t2}`));
    const reply = t1.replace("1 message", "2 messages") + "[2026-11-03 09:00] Ravi: Done, report sent\n";
    const t3 = "=== THREAD 3 · 1 message · started 2026-11-04 09:00 IST ===\n[2026-11-04 09:00] Asha: New ask for the client\n";
    const changed = changedThreads(before, parseExportThreads(`${reply}\n${t2}\n${t3}`));
    expect(changed.map((c) => c.number)).toEqual([1, 3]);
  });

  it("keeps two threads that start in the same minute by the same sender apart", () => {
    const a = "=== THREAD 1 · 1 message · started 2026-11-01 15:30 IST ===\n[2026-11-01 15:30] Asha: first\n";
    const b = "=== THREAD 2 · 1 message · started 2026-11-01 15:30 IST ===\n[2026-11-01 15:30] Asha: second\n";
    expect(parseExportThreads(`${a}\n${b}`).map((t) => t.key)).toEqual(["2026-11-01 15:30|Asha", "2026-11-01 15:30|Asha#2"]);
  });
});
