import { describe, expect, it } from "vitest";
import { shouldReopen } from "./activity-rules";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const today = d("2026-11-18");

describe("shouldReopen", () => {
  it("reopens when hours are dated after the completion day", () => {
    expect(shouldReopen({ completedOn: new Date("2026-11-10T08:00:00Z"), lastAny: d("2026-11-17"), today })).toBe(true);
  });
  it("does not reopen for hours on the completion day or before", () => {
    expect(shouldReopen({ completedOn: new Date("2026-11-10T08:00:00Z"), lastAny: d("2026-11-10"), today })).toBe(false);
  });
  it("leaves a project with no completion record or no hours alone", () => {
    expect(shouldReopen({ completedOn: null, lastAny: d("2026-11-17"), today })).toBe(false);
    expect(shouldReopen({ completedOn: new Date("2026-11-10T08:00:00Z"), lastAny: undefined, today })).toBe(false);
  });
  it("ignores hours dated in the future", () => {
    expect(shouldReopen({ completedOn: new Date("2026-11-10T08:00:00Z"), lastAny: d("2029-01-01"), today })).toBe(false);
  });
});
