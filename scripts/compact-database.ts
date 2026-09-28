/**
 * One-off (re-runnable) storage compaction for an existing database —
 * brings data written before the 2026-09-25 storage review in line with
 * what the app writes now:
 *   - audit runs: keeps each theme's newest AUDIT_RUNS_KEPT_PER_THEME
 *     complete runs, deleting older runs and their findings
 *     (lib/audit/retention.ts);
 *   - findings: drops citations that just repeat their rule's
 *     (lib/audit/ruleCitations.ts — filled back in when read);
 *   - findings: caps each stored source-snippet line (lib/audit/snippet.ts),
 *     drops null-valued optional fields and the unused __v key;
 *   - indexes: syncs every model's indexes with its schema, dropping the
 *     ones removed in the review and creating new ones (e.g. the
 *     AnalyticsSync retention TTL);
 *   - GA4 analytics (2026-09-28, installs + Try Theme only): deletes
 *     aggregate rows for any other event or a dropped breakdown (city,
 *     browser, OS), strips the old user/session metrics and null dimension
 *     placeholders from the rows kept, and drops the unique-users cache.
 *     Runs first: deletes are allowed even on a database over its storage
 *     quota, and they free the space the later writes need.
 * Prints the database size before and after.
 *
 *   npm run db:compact -- --dry-run   # report only, change nothing
 *   npm run db:compact                # apply (uses MONGODB_URI)
 */
import mongoose from "mongoose";
import { connectToDatabase } from "../lib/db/connect";
import { capSnippet } from "../lib/audit/snippet";
import { AUDIT_RUNS_KEPT_PER_THEME, pruneOldAuditRuns } from "../lib/audit/retention";
import { withoutRuleCitation } from "../lib/audit/ruleCitations";
import { AnalyticsAggregate } from "../models/analytics-aggregate";
import { AnalyticsSync } from "../models/analytics-sync";
import { AnalyticsTheme } from "../models/analytics-theme";
import { AGGREGATE_BREAKDOWNS, TRACKED_EVENTS } from "../lib/analytics/constants";
import { AuditRun } from "../models/audit-run";
import { EnhancementPoint } from "../models/enhancement-point";
import { Finding } from "../models/finding";
import { GoogleConnection } from "../models/google-connection";
import { ThemeRankHistory } from "../models/theme-rank-history";
import { ThemeVersion } from "../models/theme-version";
import { ThemeZip } from "../models/theme-zip";

const dryRun = process.argv.includes("--dry-run");

const NULLABLE_FINDING_FIELDS = [
  "requirementId",
  "lineNumber",
  "presetLabel",
  "recommendation",
  "sourceReference",
  "sourceUrl",
  "sourceSnippet",
  "ignoredReason",
  "statusUpdatedAt",
] as const;

const INDEXED_MODELS = [Finding, AuditRun, ThemeVersion, ThemeZip, ThemeRankHistory, EnhancementPoint, AnalyticsSync, AnalyticsAggregate, AnalyticsTheme, GoogleConnection];

async function dbSizeMb() {
  const s = await mongoose.connection.db!.stats();
  return { data: s.dataSize / 1e6, storage: s.storageSize / 1e6, indexes: s.indexSize / 1e6 };
}

async function main() {
  await connectToDatabase();
  const before = await dbSizeMb();
  console.log(`${dryRun ? "[dry run] " : ""}Before: data ${before.data.toFixed(2)} MB, on disk ${before.storage.toFixed(2)} MB, indexes ${before.indexes.toFixed(2)} MB`);

  // -1. GA4 analytics: only installs and Try Theme, in the kept breakdowns.
  const aggregates = mongoose.connection.db!.collection("analyticsaggregates");
  const unwanted = { $or: [{ eventName: { $nin: [...TRACKED_EVENTS] } }, { breakdown: { $nin: Object.keys(AGGREGATE_BREAKDOWNS) } }] };
  if (dryRun) {
    console.log(`Analytics rows to delete (other events / dropped breakdowns): ${await aggregates.countDocuments(unwanted)} of ${await aggregates.estimatedDocumentCount()}`);
  } else {
    const deleted = await aggregates.deleteMany(unwanted);
    console.log(`Deleted ${deleted.deletedCount} analytics rows (other events / dropped breakdowns)`);
    // Index files don't shrink when rows are deleted; after a big delete,
    // rebuild them from the few rows left (step 3 recreates them). Hosted
    // tiers that reject `compact` count those files toward their quota.
    if (deleted.deletedCount > (await aggregates.estimatedDocumentCount())) {
      await aggregates.dropIndexes();
      console.log("Dropped the analytics indexes to rebuild them from the remaining rows");
    }
  }
  const OLD_METRICS = ["totalUsers", "activeUsers", "newUsers", "sessions"].map((m) => `metrics.${m}`);
  const DIMS = ["country", "city", "deviceCategory", "browser", "operatingSystem", "sessionSource", "sessionMedium", "sessionCampaignName", "sessionDefaultChannelGroup", "landingPage", "pagePath"];
  const oldShape = { $or: [...OLD_METRICS.map((f) => ({ [f]: { $exists: true } })), ...DIMS.map((d) => ({ [`dims.${d}`]: { $type: "null" } }))] };
  const reshaped = await aggregates.countDocuments(oldShape);
  console.log(`Analytics rows to slim (old user/session metrics, null dimensions): ${reshaped}`);
  if (!dryRun && reshaped) {
    for (const d of DIMS) await aggregates.updateMany({ [`dims.${d}`]: { $type: "null" } }, { $unset: { [`dims.${d}`]: "" } });
    await aggregates.updateMany({}, { $unset: Object.fromEntries(OLD_METRICS.map((f) => [f, ""])) });
  }
  const rangeUsers = await mongoose.connection.db!.listCollections({ name: "analyticsrangeusers" }).toArray();
  if (rangeUsers.length) {
    console.log(dryRun ? "Unique-users cache (analyticsrangeusers): to drop" : "Dropped the unique-users cache (analyticsrangeusers)");
    if (!dryRun) await mongoose.connection.db!.dropCollection("analyticsrangeusers");
  }

  // 0. Retention: only the newest few complete audits per theme.
  const themeIds = await AuditRun.distinct("themeId");
  let prunedRuns = 0;
  let prunedFindings = 0;
  for (const themeId of themeIds) {
    if (dryRun) {
      const complete = await AuditRun.countDocuments({ themeId, status: "complete" });
      prunedRuns += Math.max(0, complete - AUDIT_RUNS_KEPT_PER_THEME);
    } else {
      const r = await pruneOldAuditRuns(themeId);
      prunedRuns += r.runs;
      prunedFindings += r.findings;
    }
  }
  console.log(dryRun ? `Audit runs to prune: ${prunedRuns} complete runs (plus older failed ones)` : `Pruned ${prunedRuns} audit runs and ${prunedFindings} findings (kept ${AUDIT_RUNS_KEPT_PER_THEME} per theme)`);

  // 1. Snippets: re-cap long lines.
  const findings = mongoose.connection.db!.collection("findings");
  let snippetsCapped = 0;
  let bytesSaved = 0;
  const ops: mongoose.mongo.AnyBulkWriteOperation[] = [];
  for await (const doc of findings.find({ sourceSnippet: { $type: "string" } }, { projection: { sourceSnippet: 1 } })) {
    const capped = capSnippet(doc.sourceSnippet as string);
    if (capped !== doc.sourceSnippet) {
      snippetsCapped++;
      bytesSaved += (doc.sourceSnippet as string).length - capped.length;
      ops.push({ updateOne: { filter: { _id: doc._id }, update: { $set: { sourceSnippet: capped } } } });
    }
  }
  console.log(`Snippets to cap: ${snippetsCapped} (~${(bytesSaved / 1e6).toFixed(2)} MB of text)`);
  if (!dryRun && ops.length) {
    for (let i = 0; i < ops.length; i += 1000) await findings.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  }

  // 1b. Citations that repeat the rule's own.
  const citeOps: mongoose.mongo.AnyBulkWriteOperation[] = [];
  for await (const doc of findings.find({ $or: [{ sourceReference: { $type: "string" } }, { sourceUrl: { $type: "string" } }] }, { projection: { ruleId: 1, sourceReference: 1, sourceUrl: 1 } })) {
    const stripped = withoutRuleCitation(doc as unknown as { ruleId: string; sourceReference?: string | null; sourceUrl?: string | null });
    const unset: Record<string, ""> = {};
    if (!("sourceReference" in stripped) && doc.sourceReference != null) unset.sourceReference = "";
    if (!("sourceUrl" in stripped) && doc.sourceUrl != null) unset.sourceUrl = "";
    if (Object.keys(unset).length) citeOps.push({ updateOne: { filter: { _id: doc._id }, update: { $unset: unset } } });
  }
  console.log(`Findings with a copied rule citation: ${citeOps.length}`);
  if (!dryRun && citeOps.length) {
    for (let i = 0; i < citeOps.length; i += 1000) await findings.bulkWrite(citeOps.slice(i, i + 1000), { ordered: false });
  }

  // 2. Null fields and __v.
  for (const field of NULLABLE_FINDING_FIELDS) {
    const n = await findings.countDocuments({ [field]: { $type: "null" } });
    if (n) console.log(`findings.${field}: ${n} null values to drop`);
    if (!dryRun && n) await findings.updateMany({ [field]: { $type: "null" } }, { $unset: { [field]: "" } });
  }
  const versioned = await findings.countDocuments({ __v: { $exists: true } });
  console.log(`findings.__v: ${versioned} to drop`);
  if (!dryRun && versioned) await findings.updateMany({ __v: { $exists: true } }, { $unset: { __v: "" } });

  // 3. Indexes.
  for (const model of INDEXED_MODELS) {
    if (dryRun) {
      const diff = await model.diffIndexes();
      if (diff.toDrop.length || diff.toCreate.length) console.log(`${model.modelName}: drop [${diff.toDrop.join(", ")}] create ${diff.toCreate.length}`);
    } else {
      const dropped = await model.syncIndexes();
      if (dropped.length) console.log(`${model.modelName}: dropped ${dropped.join(", ")}`);
    }
  }

  if (!dryRun) {
    // Reclaim the freed space in the rewritten collection.
    for (const collection of ["findings", "analyticsaggregates"]) {
      await mongoose.connection.db!.command({ compact: collection }).catch((err: Error) => console.warn(`compact ${collection} skipped:`, err.message));
    }
    const after = await dbSizeMb();
    console.log(`After:  data ${after.data.toFixed(2)} MB, on disk ${after.storage.toFixed(2)} MB, indexes ${after.indexes.toFixed(2)} MB`);
  }
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
