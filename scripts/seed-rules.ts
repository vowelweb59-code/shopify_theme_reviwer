// Idempotent rule metadata seed — mirrors seed-requirements.ts. The
// executable check functions live in code (lib/rules/*); this just persists
// their metadata to MongoDB so /rules can show a rule inventory, and flips
// each covered Requirement's ruleStatus to 'implemented'.
//
// Run with: npm run seed:rules

import fs from "node:fs";
import path from "node:path";
import { connectToDatabase } from "../lib/db/connect";
import { Rule } from "../models/rule";
import { Requirement } from "../models/requirement";
import { ALL_RULES } from "../lib/rules/registry";
import { computeRuleCriticality } from "../lib/audit/ruleCriticality";
import { ruleHasTestCoverage } from "../lib/audit/ruleTestCoverage";

// Live-check rules (the LIVE-* ruleId convention, in lib/audit/liveCheck.ts
// and lib/audit/pageSpeed.ts) are deliberately never registered as Rule
// documents — see ALL_RULES's own scope (static, source-code checks only).
// But their requirementId references are just as real a coverage signal as
// a static rule's, and without this, a requirement only ever checked live
// (e.g. PERF-BP-003 through 008) stays stuck at "not_implemented" forever —
// a false negative in /rules' coverage dashboard, not a real gap. Extracted
// by regex over the source text rather than importing the modules, since
// their finding-producing functions build ExecutedFinding objects at
// runtime (no static list of "requirementIds this file covers" to import).
const LIVE_CHECK_FILES = [
  path.join(__dirname, "..", "lib", "audit", "liveCheck.ts"),
  path.join(__dirname, "..", "lib", "audit", "pageSpeed.ts"),
];

function extractLiveCheckRequirementIds(): string[] {
  const ids = new Set<string>();
  for (const filePath of LIVE_CHECK_FILES) {
    const content = fs.readFileSync(filePath, "utf-8");
    for (const match of content.matchAll(/requirementId:\s*"([^"]+)"/g)) {
      ids.add(match[1]);
    }
  }
  return [...ids];
}

// Walks lib/ (fs access only needed here — a Node CLI script, never
// imported into the Next.js app runtime) and concatenates every *.test.ts
// file's content into one corpus, so ruleHasTestCoverage can do a single
// substring check per rule rather than re-reading the filesystem per rule.
function collectTestFileContents(rootDir: string): string {
  let combined = "";
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const fullPath = path.join(rootDir, entry.name);
    if (entry.isDirectory()) {
      combined += collectTestFileContents(fullPath);
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      combined += fs.readFileSync(fullPath, "utf-8");
    }
  }
  return combined;
}

async function main() {
  await connectToDatabase();

  const testCorpus = collectTestFileContents(path.join(__dirname, "..", "lib"));

  let created = 0;
  let updated = 0;
  let requirementsMarkedImplemented = 0;
  let withTests = 0;

  for (const rule of ALL_RULES) {
    const existed = await Rule.exists({ ruleId: rule.ruleId });
    const hasTests = ruleHasTestCoverage(rule.ruleId, testCorpus);
    if (hasTests) withTests++;

    await Rule.findOneAndUpdate(
      { ruleId: rule.ruleId },
      {
        $set: {
          requirementId: rule.requirementId ?? null,
          category: rule.category,
          defaultSeverity: rule.defaultSeverity,
          title: rule.title,
          description: rule.description,
          sourceReference: rule.sourceReference ?? null,
          sourceUrl: rule.sourceUrl ?? null,
          enabled: true,
          hasTests,
          criticality: computeRuleCriticality(rule.category, rule.defaultSeverity),
        },
        $setOnInsert: { version: 1 },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (existed) updated++;
    else created++;

    if (rule.requirementId) {
      const result = await Requirement.updateOne(
        { requirementId: rule.requirementId, ruleStatus: { $ne: "implemented" } },
        { $set: { ruleStatus: "implemented" } }
      );
      if (result.modifiedCount > 0) requirementsMarkedImplemented++;
    }
  }

  const liveCheckRequirementIds = extractLiveCheckRequirementIds();
  let liveCheckRequirementsMarked = 0;
  for (const requirementId of liveCheckRequirementIds) {
    const result = await Requirement.updateOne(
      { requirementId, ruleStatus: { $ne: "implemented" } },
      { $set: { ruleStatus: "implemented" } }
    );
    if (result.modifiedCount > 0) liveCheckRequirementsMarked++;
  }

  console.log(
    `Seed complete: ${created} rules created, ${updated} updated, ${ALL_RULES.length} total. ` +
      `${requirementsMarkedImplemented} requirement(s) marked implemented. ${withTests}/${ALL_RULES.length} rules have test coverage. ` +
      `${liveCheckRequirementsMarked}/${liveCheckRequirementIds.length} live-check-only requirement(s) also marked implemented.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
