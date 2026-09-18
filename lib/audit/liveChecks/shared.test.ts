import { describe, expect, it } from "vitest";
import { mapWithConcurrency } from "./shared";

describe("mapWithConcurrency", () => {
  it("preserves each result at its original index", async () => {
    const items = [1, 2, 3, 4, 5];
    const results = await mapWithConcurrency(items, 2, async (n) => n * 10);
    expect(results).toEqual([10, 20, 30, 40, 50]);
  });

  it("never runs more than `limit` invocations concurrently", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    await mapWithConcurrency(items, 3, async (n) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active--;
      return n;
    });
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("runs strictly one at a time when limit is 1", async () => {
    const order: number[] = [];
    const items = [1, 2, 3];
    await mapWithConcurrency(items, 1, async (n) => {
      order.push(n);
      await new Promise((resolve) => setTimeout(resolve, 1));
      return n;
    });
    expect(order).toEqual([1, 2, 3]);
  });

  it("handles a limit greater than the item count without error", async () => {
    const results = await mapWithConcurrency([1, 2], 10, async (n) => n + 1);
    expect(results).toEqual([2, 3]);
  });
});
