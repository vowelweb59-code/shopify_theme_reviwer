import { describe, expect, it } from "vitest";
import { ALL_RULES } from "@/lib/rules/registry";
import { withRuleCitations, withoutRuleCitation } from "./ruleCitations";

const cited = ALL_RULES.find((r) => r.sourceReference && r.sourceUrl)!;

describe("rule citations", () => {
  it("drops a citation that repeats the rule's own, and fills it back in on read", () => {
    const stored = withoutRuleCitation({ ruleId: cited.ruleId, finding: "x", sourceReference: cited.sourceReference, sourceUrl: cited.sourceUrl });
    expect(stored).not.toHaveProperty("sourceReference");
    expect(stored).not.toHaveProperty("sourceUrl");
    const [read] = withRuleCitations([stored]);
    expect(read).toMatchObject({ sourceReference: cited.sourceReference, sourceUrl: cited.sourceUrl });
  });

  it("keeps a finding's own citation (e.g. a PageSpeed audit link)", () => {
    const own = { ruleId: cited.ruleId, sourceReference: "Google Lighthouse / PageSpeed Insights", sourceUrl: "https://developer.chrome.com/docs/lighthouse/x" };
    expect(withoutRuleCitation(own)).toEqual(own);
    expect(withRuleCitations([own])[0]).toEqual(own);
  });

  it("leaves findings of unknown rules untouched", () => {
    const f = { ruleId: "PERF-PSI-lcp", sourceUrl: "https://example.com" };
    expect(withoutRuleCitation(f)).toEqual(f);
    expect(withRuleCitations([f])[0]).toEqual(f);
  });
});
