// Minimal stage-timing helper for audit observability (phase-8 §14,
// phase-4 §21) — just enough to see where an audit run's time actually
// went and catch performance regressions, not a general profiler.
export class Stopwatch {
  private readonly clock: () => number;
  private readonly start: number;
  private last: number;
  private readonly marks: Record<string, number> = {};

  constructor(clock: () => number = Date.now) {
    this.clock = clock;
    this.start = clock();
    this.last = this.start;
  }

  /** Records elapsed ms since the previous lap() (or construction) under `label`. */
  lap(label: string): number {
    const now = this.clock();
    const elapsed = now - this.last;
    this.marks[label] = elapsed;
    this.last = now;
    return elapsed;
  }

  /** Merges in a duration measured elsewhere (e.g. a sub-stage timed by the callee itself) without touching the clock. */
  record(label: string, ms: number): void {
    this.marks[label] = ms;
  }

  toRecord(): Record<string, number> {
    return { ...this.marks, total: this.clock() - this.start };
  }
}
