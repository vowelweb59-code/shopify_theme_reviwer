import { describe, expect, it } from "vitest";
import { isMovedToOtherDept } from "./dept-placement";

const CUT = "2026-10-27";
const moved = (status: string, override: "STAY" | "MOVED" | null, any: string, dm: string) =>
  isMovedToOtherDept({ status, deptOverride: override }, any, dm, CUT);

describe("isMovedToOtherDept", () => {
  it("moves a project others report on but the team has not for 30 days", () => {
    expect(moved("ACTIVE", null, "2026-11-20", "2026-10-01")).toBe(true);
    expect(moved("ON_HOLD", null, "2026-11-20", "")).toBe(true);
  });

  it("keeps a project the team reported on, or nobody did", () => {
    expect(moved("ACTIVE", null, "2026-11-20", "2026-11-18")).toBe(false);
    expect(moved("ACTIVE", null, "2026-09-01", "2026-09-01")).toBe(false);
    expect(moved("ACTIVE", null, "", "")).toBe(false);
  });

  it("lets the manual placement beat the rule", () => {
    expect(moved("ACTIVE", "STAY", "2026-11-20", "2026-10-01")).toBe(false);
    expect(moved("ACTIVE", "MOVED", "2026-11-20", "2026-11-18")).toBe(true);
  });

  it("never places other statuses", () => {
    expect(moved("BLOCKED", "MOVED", "2026-11-20", "")).toBe(false);
    expect(moved("PARTIAL_HOLD", null, "2026-11-20", "")).toBe(false);
    expect(moved("COMPLETED", "MOVED", "2026-11-20", "")).toBe(false);
  });
});
