import { describe, expect, it } from "vitest";
import { planClosures, type HeldProject } from "./ended-posts";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const held = (o: Partial<HeldProject> & { id: string; name: string }): HeldProject => ({ clientNames: [o.name], profileId: "p1", siblings: 0, ...o });
const ended = (client: string, posted: string, profileId: string | null = "p1", rating: number | null = 5) => ({ client, rating, profileId, profileText: profileId, posted: d(posted), ref: `chat:${client}${posted}` });

describe("planClosures", () => {
  it("closes a held project whose contract ended", () => {
    const r = planClosures([held({ id: "a", name: "Tim Fitz" })], [ended("tim fitz", "2026-03-01")], []);
    expect(r.close).toHaveLength(1);
    expect(r.close[0]).toMatchObject({ projectId: "a", rating: 5 });
  });
  it("reports projects with no ended post", () => {
    expect(planClosures([held({ id: "a", name: "Zed" })], [], []).noPost).toEqual(["Zed"]);
  });
  it("skips an ended post that names another profile", () => {
    const r = planClosures([held({ id: "a", name: "Tim Fitz" })], [ended("Tim Fitz", "2026-03-01", "p2")], []);
    expect(r.close).toHaveLength(0);
    expect(r.skipped[0].why).toMatch(/another profile/);
  });
  it("skips when the client has other open projects and the post names no profile", () => {
    const r = planClosures([held({ id: "a", name: "Tim Fitz", siblings: 1 })], [ended("Tim Fitz", "2026-03-01", null)], []);
    expect(r.close).toHaveLength(0);
    expect(r.skipped[0].why).toMatch(/names no profile/);
  });
  it("skips a contract that was accepted again after it ended", () => {
    const r = planClosures([held({ id: "a", name: "Tim Fitz" })], [ended("Tim Fitz", "2026-03-01")], [{ client: "Tim Fitz", profileId: "p1", posted: d("2026-05-01") }]);
    expect(r.close).toHaveLength(0);
    expect(r.skipped[0].why).toMatch(/restarted/);
  });
  it("uses the newest ended post", () => {
    const r = planClosures([held({ id: "a", name: "Tim Fitz" })], [ended("Tim Fitz", "2026-01-01", "p1", 3), ended("Tim Fitz", "2026-03-01", "p1", 5)], []);
    expect(r.close[0].rating).toBe(5);
  });
});
