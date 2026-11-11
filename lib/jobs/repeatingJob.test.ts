import { afterEach, describe, expect, it, vi } from "vitest";
import { createRepeatingJob } from "./repeatingJob";

afterEach(() => {
  vi.useRealTimers();
  (globalThis as { _repeatingJobs?: Map<string, unknown> })._repeatingJobs?.clear();
});

describe("createRepeatingJob", () => {
  it("runs at once, then after each run ends, and ignores a second start", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue(undefined);
    const start = createRepeatingJob("t1", "t1", 1000, run);
    await start();
    await start();
    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("keeps looping after a run throws", async () => {
    vi.useFakeTimers();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    await createRepeatingJob("t2", "t2", 1000, run)();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(err).toHaveBeenCalled();
    err.mockRestore();
  });
});
