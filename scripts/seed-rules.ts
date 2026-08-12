// Idempotent rule metadata seed — mirrors seed-requirements.ts. The
// executable check functions live in code (lib/rules/*); this just persists
// their metadata to MongoDB so /rules can show a rule inventory, and flips
// each covered Requirement's ruleStatus to 'implemented'.
//
// Run with: npm run seed:rules

import { connectToDatabase } from "../lib/db/connect";
import { Rule } from "../models/rule";
import { Requirement } from "../models/requirement";
import { ALL_RULES } from "../lib/rules/registry";

async function main() {
  await connectToDatabase();

  let created = 0;
  let updated = 0;
  let requirementsMarkedImplemented = 0;

  for (const rule of ALL_RULES) {
    const existed = await Rule.exists({ ruleId: rule.ruleId });

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
    `Seed complete: ${created} rules created, ${updated} updated, ${ALL_RULES.length} total. ${requirementsMarkedImplemented} requirement(s) marked implemented.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
