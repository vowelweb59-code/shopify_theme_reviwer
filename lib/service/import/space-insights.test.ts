import { describe, expect, it } from "vitest";
import { analyseSpace, type SpaceMessage } from "./space-insights";

const msg = (id: string, at: string, text: string, sender = "Asha"): SpaceMessage => ({ id, sender, postedAt: `${at}T10:00:00Z`, text });

describe("analyseSpace", () => {
  it("lists an open task and drops one a later message says is done", () => {
    const r = analyseSpace([
      msg("1", "2026-11-01", "Please send the updated SEO report to the client by tomorrow"),
      msg("2", "2026-11-01", "Can you check the checkout page speed for the Baskota store"),
      msg("3", "2026-11-02", "Done, SEO report sent to the client", "Ravi"),
    ]);
    expect(r.tasks.map((t) => t.id)).toEqual(["2"]);
    expect(r.doneTasks).toBe(1);
  });

  it("does not count a done message after a week", () => {
    const r = analyseSpace([
      msg("1", "2026-11-01", "Please send the updated SEO report to the client"),
      msg("2", "2026-11-20", "SEO report sent to the client"),
    ]);
    expect(r.tasks.map((t) => t.id)).toEqual(["1"]);
  });

  it("finds pitch opportunities and labels them", () => {
    const r = analyseSpace([
      msg("1", "2026-11-01", "The client wants to redesign the whole store next month"),
      msg("2", "2026-11-02", "Their store is slow and the bounce rate is high, we can pitch a speed audit"),
      msg("3", "2026-11-03", "Good morning everyone, have a great day team"),
    ]);
    expect(r.opportunities.map((o) => o.id)).toEqual(["2", "1"]);
    expect(r.opportunities[1].reason).toBe("Client asks for more");
  });

  it("ignores very short messages and handles an empty space", () => {
    expect(analyseSpace([msg("1", "2026-11-01", "please do")]).tasks).toEqual([]);
    expect(analyseSpace([])).toMatchObject({ scanned: 0, from: null, tasks: [], opportunities: [] });
  });
});

describe("formatSpaceThreads", () => {
  it("groups replies under their thread, times in IST", async () => {
    const { formatSpaceThreads } = await import("./space-insights");
    const text = formatSpaceThreads([
      { ...msg("1", "2026-11-01", "Please send the report"), threadName: "t/a" },
      { ...msg("2", "2026-11-01", "Lunch?"), threadName: "t/b" },
      { ...msg("3", "2026-11-02", "Report sent", "Ravi"), threadName: "t/a" },
    ]);
    expect(text).toContain("=== THREAD 1 · 2 messages · started 2026-11-01 15:30 IST ===");
    expect(text.indexOf("Please send the report")).toBeLessThan(text.indexOf("Report sent"));
    expect(text.indexOf("Report sent")).toBeLessThan(text.indexOf("Lunch?"));
  });
});
