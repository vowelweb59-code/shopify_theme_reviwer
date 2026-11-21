import { describe, expect, it } from "vitest";
import { revenueByProject, type RevProject } from "./by-project";

const project = (o: Partial<RevProject> & { id: string }): RevProject => ({ name: o.id, status: "ACTIVE", clientId: "c1", profileKeys: [], type: "HOURLY", rateCents: 1000, ...o });
const clients = [{ id: "c1", name: "Alpha Ltd", aliases: [] }, { id: "c2", name: "Beta Inc", aliases: [] }];
const run = (o: Partial<Parameters<typeof revenueByProject>[0]>, from = "2026-09", to = "2026-09") =>
  revenueByProject({ projects: [], clients, hours: [], taken: [], ...o }, from, to);
const line = (r: ReturnType<typeof run>, id: string) => r.projects.find((p) => p.id === id)!;

describe("revenueByProject", () => {
  it("lists every project, active when it has hours or money in the period and inactive otherwise", () => {
    const r = run({
      projects: [project({ id: "a" }), project({ id: "b", clientId: "c2" }), project({ id: "idle", clientId: null })],
      hours: [{ projectId: "a", month: "2026-09", minutes: 600 }, { projectId: "a", month: "2026-01", minutes: 600 }],
      taken: [{ month: "2026-09", clientName: "Beta Inc", profile: null, amountCents: 5000 }],
    });
    expect(r.projects).toHaveLength(3);
    expect(line(r, "a")).toMatchObject({ active: true, minutes: 600, shouldCents: 10000, hasSheetMoney: false });
    expect(line(r, "b")).toMatchObject({ active: true, hasSheetMoney: true, takenCents: 5000, minutes: 0 });
    expect(line(r, "idle")).toMatchObject({ active: false, hasSheetMoney: false, clientName: null });
  });

  it("gives a sheet row to the project whose Upwork profile matches, and splits the rest by that month's hours", () => {
    const r = run({
      projects: [project({ id: "p1", profileKeys: ["zainab"] }), project({ id: "p2", profileKeys: ["batul"] })],
      hours: [{ projectId: "p1", month: "2026-09", minutes: 300 }, { projectId: "p2", month: "2026-09", minutes: 900 }],
      taken: [
        { month: "2026-09", clientName: "Alpha Ltd", profile: "Zainab", amountCents: 1000 },
        { month: "2026-09", clientName: "Alpha Ltd", profile: null, amountCents: 4000 },
      ],
    });
    expect(line(r, "p1").takenCents).toBeCloseTo(1000 + 1000);
    expect(line(r, "p2").takenCents).toBeCloseTo(3000);
  });

  it("splits equally when the client's projects have no hours, and keeps sheet money of a client with no project apart", () => {
    const r = run({
      projects: [project({ id: "p1" }), project({ id: "p2" })],
      taken: [{ month: "2026-09", clientName: "Alpha Ltd", profile: null, amountCents: 1000 }, { month: "2026-09", clientName: "Nobody Co", profile: null, amountCents: 700 }],
    });
    expect(line(r, "p1").takenCents).toBeCloseTo(500);
    expect(line(r, "p2").takenCents).toBeCloseTo(500);
    expect(r.sheetOnly).toEqual([{ name: "Nobody Co", cents: 700 }]);
  });

  it("prices a fixed project with no rate at $15/h and leaves hourly work with no rate unpriced", () => {
    const r = run({
      projects: [project({ id: "f", type: "FIXED", rateCents: null }), project({ id: "h", rateCents: null })],
      hours: [{ projectId: "f", month: "2026-09", minutes: 60 }, { projectId: "h", month: "2026-09", minutes: 60 }],
    });
    expect(line(r, "f").shouldCents).toBe(1500);
    expect(line(r, "h")).toMatchObject({ shouldCents: 0, unpricedMinutes: 60 });
  });

  it("counts the same number of projects whatever the period", () => {
    const projects = [project({ id: "a" }), project({ id: "b" }), project({ id: "c", clientId: null })];
    expect(run({ projects }, "2026-09", "2026-09").projects).toHaveLength(3);
    expect(run({ projects }, "2025-01", "2026-09").projects).toHaveLength(3);
  });
});
