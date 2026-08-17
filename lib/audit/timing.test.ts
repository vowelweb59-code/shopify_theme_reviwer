import { describe, expect, it } from "vitest";
import { Stopwatch } from "./timing";

describe("Stopwatch", () => {
  it("records elapsed ms per lap and a running total", () => {
    let now = 1000;
    const sw = new Stopwatch(() => now);

    now = 1300;
    expect(sw.lap("parsing")).toBe(300);

    now = 1450;
    expect(sw.lap("rules")).toBe(150);

    expect(sw.toRecord()).toEqual({ parsing: 300, rules: 150, total: 450 });
  });

  it("returns just the total when no laps were recorded", () => {
    let now = 500;
    const sw = new Stopwatch(() => now);
    now = 520;
    expect(sw.toRecord()).toEqual({ total: 20 });
  });

  it("re-recording the same label overwrites, not accumulates", () => {
    let now = 0;
    const sw = new Stopwatch(() => now);
    now = 10;
    sw.lap("x");
    now = 25;
    sw.lap("x");
    expect(sw.toRecord()).toEqual({ x: 15, total: 25 });
  });
});
