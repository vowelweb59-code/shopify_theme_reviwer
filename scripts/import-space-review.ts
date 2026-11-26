import { readFile } from "node:fs/promises";
import { connectToDatabase } from "@/lib/db/connect";
import { recordServiceAudit } from "@/lib/service/audit/record";
import { parseSpaceReview } from "@/lib/service/import/space-review";
import { ServiceSpaceReview } from "@/models/service-space-review";

// Loads the reviewed pending-task / opportunity lists of a Chat space for the Space scan tab (owner, 2026-11-26). The JSON file stays OUTSIDE the
// repository (it holds client details). Replaces the space's document. Dry run unless --apply; the owner runs --apply. Audit: space_review.import.
//
//   npx tsx --env-file=.env.production.local scripts/import-space-review.ts "<file.json>" [--apply]
const apply = process.argv.includes("--apply");

async function main() {
  const file = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (!file) throw new Error('Usage: import-space-review.ts "<file.json>" [--apply]');
  const review = parseSpaceReview(JSON.parse(await readFile(file, "utf8")));
  console.log(
    `${apply ? "APPLYING" : "Dry run"}: ${review.space} (${review.client ?? "no client"}), reviewed ${review.reviewedAt}: ${review.tasks.length} tasks, ${review.opportunities.length} opportunities.`
  );
  if (!apply) return console.log("Nothing written. Add --apply to save (replaces this space's list).");
  await connectToDatabase();
  await ServiceSpaceReview.replaceOne({ _id: review.space }, { _id: review.space, ...review, reviewedAt: new Date(review.reviewedAt) }, { upsert: true });
  await recordServiceAudit("space_review.import", { space: review.space, tasks: review.tasks.length, opportunities: review.opportunities.length });
  console.log("Done.");
}

main().then(
  () => process.exit(0),
  (e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
);
