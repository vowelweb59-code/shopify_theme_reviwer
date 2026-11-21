import { describe, expect, it } from "vitest";
import { forgetMemo, memo } from "./memo";

describe("memo", () => {
  it("loads once inside the ttl, again after it, and shares a load in flight", async () => {
    let calls = 0;
    const load = async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 10));
      return calls;
    };
    const [a, b] = await Promise.all([memo("t:a", 1000, load), memo("t:a", 1000, load)]);
    expect([a, b, calls]).toEqual([1, 1, 1]);
    expect(await memo("t:a", 1000, load)).toBe(1);
    expect(await memo("t:a", -1, load)).toBe(2);
  });
  it("does not keep a failure", async () => {
    await expect(
      memo("t:fail", 1000, async () => {
        throw new Error("x");
      })
    ).rejects.toThrow("x");
    expect(await memo("t:fail", 1000, async () => 7)).toBe(7);
  });
  it("forgets by prefix", async () => {
    let n = 0;
    await memo("t:p1", 1000, async () => ++n);
    forgetMemo("t:p");
    expect(await memo("t:p1", 1000, async () => ++n)).toBe(2);
  });
});
