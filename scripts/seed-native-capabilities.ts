// Idempotent seed for "native capability" enhancement points — Shopify
// platform features a theme can build with Liquid/JS/CSS alone, replacing
// something a merchant would otherwise pay an app for. Upserts by pointId,
// safe to re-run.
//
// Each point is grounded in a real shopify.dev/help.shopify.com
// documentation URL, sourced via research rather than aggregation (see
// data/native-capabilities.json). But — added 2026-09-11 — a second,
// independent measurement is layered on top where it holds up: how many of
// the 335 harvested Theme Store themes' release notes actually mention
// having built on that primitive. That measurement reuses the exact same
// topic-regex + aggregation pipeline as the theme-store-trend points (see
// topics.mjs's "Native capabilities" section and data/theme-trend-points.json)
// — it's just layered onto a point whose PRIMARY discovery method was
// documentation research, not release-note mining, which is what `source`
// on EnhancementPoint still records.
//
// Two of the fourteen points deliberately do NOT get a measured adoption %
// even though a regex was written and tried for them — see
// UNRELIABLE_ADOPTION_MEASUREMENT below. A high check-overlap against an
// existing theme-store-trend point (same rigor as scripts/research/topics.mjs's
// Round 2 comment) showed the "match" was really just re-detecting notes
// already counted by a different, broader point, not a distinct signal:
//   - NATIVE-CART-001 (Shop Pay Installments): 100% of matches also matched
//     the existing "Shop Pay and accelerated checkout" trend point — "shop
//     pay" as a bare phrase can't be told apart from installments-specific
//     mentions in a release-note bullet.
//   - NATIVE-A11Y-001 (color_contrast filter): 67% overlap with
//     "Accessibility remediation", and reading the samples confirmed why —
//     "color contrast" in a release note is overwhelmingly a general
//     accessibility bug-fix mention, not evidence a theme uses the specific
//     color_contrast Liquid filter. Reporting a number here would imply a
//     precision the measurement doesn't actually have.
// Both stay documentation-only (adoptionTier/themeCount/etc. left null),
// same as before this measurement pass existed.
//
// Run with: npm run seed:native-capabilities

import { readFileSync } from "node:fs";
import path from "node:path";
import { connectToDatabase } from "../lib/db/connect";
import {
  EnhancementPoint,
  ENHANCEMENT_CATEGORIES,
  NATIVE_CAPABILITY_COMPLETENESS,
} from "../models/enhancement-point";
import { tierForPercentage } from "../lib/enhancements/tiers";

type Category = (typeof ENHANCEMENT_CATEGORIES)[number];
type Completeness = (typeof NATIVE_CAPABILITY_COMPLETENESS)[number];

type NativeCapability = {
  pointId: string;
  name: string;
  category: Category;
  description: string;
  auditHint: string;
  appCategoryReplaced: string;
  nativeCapabilityCompleteness: Completeness;
  sourceName: string;
  sourceUrl: string;
};

type TrendPoint = {
  pointId: string;
  adoption: {
    themeCount: number;
    themeTotal: number;
    percentage: number;
    noteCount: number;
    addedNoteCount: number;
    firstSeen: string | null;
    lastSeen: string | null;
  };
  examples: { theme: string; note: string; version: string | null; date: string | null }[];
};

const UNRELIABLE_ADOPTION_MEASUREMENT = new Set(["NATIVE-CART-001", "NATIVE-A11Y-001"]);

async function main() {
  const dataPath = path.join(process.cwd(), "data", "native-capabilities.json");
  const capabilities: NativeCapability[] = JSON.parse(readFileSync(dataPath, "utf8"));

  const trendDataPath = path.join(process.cwd(), "data", "theme-trend-points.json");
  const trendPoints: TrendPoint[] = JSON.parse(readFileSync(trendDataPath, "utf8")).points;
  const trendByPointId = new Map(trendPoints.map((p) => [p.pointId, p]));

  await connectToDatabase();

  const seenIds = new Set<string>();
  let created = 0;
  let updated = 0;
  let measured = 0;

  for (const cap of capabilities) {
    if (seenIds.has(cap.pointId)) throw new Error(`Duplicate pointId in native-capabilities.json: ${cap.pointId}`);
    seenIds.add(cap.pointId);

    if (!ENHANCEMENT_CATEGORIES.includes(cap.category)) {
      throw new Error(`${cap.pointId}: unknown category "${cap.category}"`);
    }
    if (!NATIVE_CAPABILITY_COMPLETENESS.includes(cap.nativeCapabilityCompleteness)) {
      throw new Error(`${cap.pointId}: unknown nativeCapabilityCompleteness "${cap.nativeCapabilityCompleteness}"`);
    }
    if (!/^https:\/\/(shopify\.dev|help\.shopify\.com)\//.test(cap.sourceUrl)) {
      throw new Error(
        `${cap.pointId}: sourceUrl must be a real shopify.dev or help.shopify.com page, got "${cap.sourceUrl}"`
      );
    }

    const trend = UNRELIABLE_ADOPTION_MEASUREMENT.has(cap.pointId) ? undefined : trendByPointId.get(cap.pointId);
    if (trend) measured++;

    const existed = await EnhancementPoint.exists({ pointId: cap.pointId });

    await EnhancementPoint.findOneAndUpdate(
      { pointId: cap.pointId },
      {
        $set: {
          name: cap.name,
          category: cap.category,
          description: cap.description,
          auditHint: cap.auditHint,
          source: "native-capability",
          // Explicit nulls when no reliable measurement exists, rather than
          // omitting the fields — so a stale value from a prior run (or a
          // schema version before this measurement pass existed) can never
          // linger on an existing document.
          adoptionTier: trend ? tierForPercentage(trend.adoption.percentage) : null,
          themeCount: trend?.adoption.themeCount ?? null,
          themeTotal: trend?.adoption.themeTotal ?? null,
          adoptionPercentage: trend?.adoption.percentage ?? null,
          noteCount: trend?.adoption.noteCount ?? null,
          addedNoteCount: trend?.adoption.addedNoteCount ?? null,
          firstSeen: trend?.adoption.firstSeen ?? null,
          lastSeen: trend?.adoption.lastSeen ?? null,
          examples: trend?.examples ?? [],
          appCategoryReplaced: cap.appCategoryReplaced,
          nativeCapabilityCompleteness: cap.nativeCapabilityCompleteness,
          sourceName: cap.sourceName,
          sourceUrl: cap.sourceUrl,
        },
        $setOnInsert: { status: "backlog" },
      },
      { upsert: true, returnDocument: "after" }
    );

    if (existed) updated++;
    else created++;
  }

  console.log(`Native capabilities seeded: ${created} created, ${updated} updated, ${capabilities.length} total.`);
  console.log(`Adoption measured for ${measured}/${capabilities.length} (the rest are documentation-only — see UNRELIABLE_ADOPTION_MEASUREMENT).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
