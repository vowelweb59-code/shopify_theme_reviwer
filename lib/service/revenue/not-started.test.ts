import { describe, expect, it } from "vitest";
import { NOT_STARTED_HOLD_REASON } from "../projects/activity-rules";
import { isNotStartedProject } from "./load";

const h = (toStatus: string, reason: string | null, at: string) => ({ toStatus, reason, at: new Date(at) });

describe("isNotStartedProject", () => {
  it("counts a Not started project", () => {
    expect(isNotStartedProject("NOT_STARTED", [])).toBe(true);
  });
  it("counts a project held by the Not-started rule, until the owner changes it", () => {
    const held = [h("ON_HOLD", NOT_STARTED_HOLD_REASON, "2026-11-24T10:00:00Z")];
    expect(isNotStartedProject("ON_HOLD", held)).toBe(true);
    expect(isNotStartedProject("ON_HOLD", [...held, h("ON_HOLD", "Client away", "2026-11-25T10:00:00Z")])).toBe(false);
    expect(isNotStartedProject("ACTIVE", held)).toBe(false);
  });
  it("leaves other holds alone", () => {
    expect(isNotStartedProject("ON_HOLD", [h("ON_HOLD", "Automatic: no hours for 30 working days", "2026-11-01T00:00:00Z")])).toBe(false);
  });
});
