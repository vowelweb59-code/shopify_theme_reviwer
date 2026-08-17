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

  console.log(
    `Seed complete: ${created} rules created, ${updated} updated, ${ALL_RULES.length} total. ` +
      `${requirementsMarkedImplemented} requirement(s) marked implemented. ${withTests}/${ALL_RULES.length} rules have test coverage.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
