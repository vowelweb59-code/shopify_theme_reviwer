/**
 * Pure check (phase-7 §16): does any test reference this rule at all?
 * A heuristic (a literal substring match, not real coverage
 * instrumentation), but reliable in practice — every rule test in this
 * project looks its rule up via `RULES.find(r => r.ruleId === "...")`,
 * so the ruleId string always appears verbatim in a file that tests it.
 * The actual filesystem walk that gathers `allTestFileContents` lives in
 * scripts/seed-rules.ts (a Node CLI script) rather than here, since this
 * module may be imported from the Next.js app runtime and shouldn't pull
 * in `fs`.
 */
export function ruleHasTestCoverage(ruleId: string, allTestFileContents: string): boolean {
  return allTestFileContents.includes(ruleId);
}
