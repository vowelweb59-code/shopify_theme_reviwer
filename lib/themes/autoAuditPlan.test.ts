import { describe, expect, it } from "vitest";
import { AUDIT_EVERY_MS, pickNextDueTheme } from "./autoAuditPlan";

const now = new Date("2026-11-12T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("pickNextDueTheme", () => {
  it("takes a never-audited theme first, by name", () => {
    const next = pickNextDueTheme([{ _id: 1, name: "Zeal", autoAuditAt: ago(AUDIT_EVERY_MS * 5) }, { _id: 2, name: "Soft" }, { _id: 3, name: "Adorn" }], now);
    expect(next?.name).toBe("Adorn");
  });
  it("takes the theme waiting longest once all have been audited", () => {
    const next = pickNextDueTheme([{ _id: 1, name: "A", autoAuditAt: ago(AUDIT_EVERY_MS + 1000) }, { _id: 2, name: "B", autoAuditAt: ago(AUDIT_EVERY_MS * 3) }], now);
    expect(next?.name).toBe("B");
  });
  it("returns nothing while every theme was audited within 48 hours", () => {
    expect(pickNextDueTheme([{ _id: 1, name: "A", autoAuditAt: ago(AUDIT_EVERY_MS - 1000) }], now)).toBeNull();
  });
  it("skips themes that are not live", () => {
    expect(pickNextDueTheme([{ _id: 1, name: "A", themeStoreLive: false }], now)).toBeNull();
  });
});
