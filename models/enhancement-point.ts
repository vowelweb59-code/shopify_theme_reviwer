import { Schema, model, models, type InferSchemaType } from "mongoose";

// Enhancement points are deliberately a SEPARATE collection from Requirement,
// not a flagged subset of it. Requirement drives submission readiness: the
// report and export routes both call `Requirement.find()` unfiltered and feed
// the result into coverage %, which readiness thresholds are compared against.
// Mixing ~47 optional points into that collection would silently drop every
// theme's coverage and could flip passing themes to NOT_READY. These points
// answer a different question — "what do competing themes already ship that
// this one does not?" — and must never affect approval status.

export const ENHANCEMENT_CATEGORIES = [
  "Content & Media",
  "Merchandising",
  "Theme Customization",
  "Product Discovery",
  "Cart & Checkout",
  "Platform Integration",
  "Internationalization",
  "Accessibility",
  "Performance",
  "SEO & AEO",
  "Trust & Compliance",
] as const;

// Adoption tiers and their percentage thresholds live in
// lib/enhancements/tiers.ts — that module is mongoose-free so the client-side
// /enhancements page can import the labels without pulling Mongoose into the
// browser bundle. Re-exported here so `models` stays the one import site for
// this schema's enums.
export { ADOPTION_TIERS, type AdoptionTier } from "@/lib/enhancements/tiers";
import { ADOPTION_TIERS } from "@/lib/enhancements/tiers";

// Per-theme triage. Nothing here blocks submission — "dismissed" exists so a
// point that does not apply to a given theme's niche can be cleared from the
// backlog without pretending it was built.
export const ENHANCEMENT_STATUSES = ["backlog", "planned", "implemented", "dismissed"] as const;

// Two different kinds of evidence back a point, so they carry different
// fields (see below) — both live in this one collection/list/report tab
// rather than a parallel system, per the same "don't duplicate the UI"
// reasoning that keeps everything else about this feature in one place.
// `source` records how a point was PRIMARILY discovered/curated, not
// whether it happens to carry an adoption %:
//   theme-store-trend    — discovered by mining the 335-theme corpus for
//                           recurring release-note phrasing.
//   native-capability     — discovered by researching shopify.dev/
//                           help.shopify.com docs for capabilities buildable
//                           with theme-side Liquid/JS/CSS alone, no app
//                           install of any kind (not even a first-party one,
//                           and not Shopify Functions/Flow, which still
//                           require an app scaffold to deploy).
// Both CAN carry adoptionTier/themeCount/etc.: a native-capability point can
// also have its release-note adoption measured (scripts/seed-native-
// capabilities.ts merges that in from the same aggregation pipeline where
// the regex holds up under an overlap check) — but several intentionally
// don't, because the phrase that would need to be searched for turned out
// to be indistinguishable from an existing, broader point's notes (see that
// script's UNRELIABLE_ADOPTION_MEASUREMENT). A null adoptionTier means
// "not reliably measurable this way", not "zero adoption".
export const ENHANCEMENT_SOURCES = ["theme-store-trend", "native-capability"] as const;

// Only meaningful for source: "native-capability" — whether the capability
// is fully buildable without any app, or only partially (e.g. a native
// signup form exists, but the actual notification send typically still
// needs Shopify Flow or an app). Kept as an honest caveat rather than
// overselling a partial capability as a full app replacement.
export const NATIVE_CAPABILITY_COMPLETENESS = ["full", "partial"] as const;

const exampleSchema = new Schema(
  {
    theme: { type: String, required: true },
    note: { type: String, required: true },
    version: { type: String, default: null },
    date: { type: String, default: null },
  },
  { _id: false }
);

const enhancementPointSchema = new Schema(
  {
    // Stable human-assigned ID (e.g. "TREND-CART-001"), mirroring the
    // Requirement.requirementId convention so re-seeding never duplicates.
    pointId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    category: { type: String, required: true, enum: ENHANCEMENT_CATEGORIES, index: true },
    description: { type: String, required: true },
    // What to actually look for when auditing a theme against this point.
    auditHint: { type: String, default: null },

    source: { type: String, required: true, enum: ENHANCEMENT_SOURCES, default: "theme-store-trend", index: true },

    // --- theme-store-trend fields — null for source: "native-capability" ---
    adoptionTier: { type: String, enum: ADOPTION_TIERS, default: null }, // indexed via {adoptionTier, themeCount} below
    // Distinct themes (of themeTotal analysed) whose release notes ship this.
    themeCount: { type: Number, default: null },
    themeTotal: { type: Number, default: null },
    adoptionPercentage: { type: Number, default: null },
    // Total matching release-note entries, and the subset under an
    // "Added"/"New"/"Feature"-style heading rather than a bug-fix heading.
    noteCount: { type: Number, default: null },
    addedNoteCount: { type: Number, default: null },
    // ISO dates of the earliest and latest release mentioning the capability.
    // A recent firstSeen is the strongest signal that a point is a genuine
    // future-facing trend rather than a long-settled feature.
    firstSeen: { type: String, default: null },
    lastSeen: { type: String, default: null },
    // Verbatim release-note evidence, so a reviewer can check the claim
    // instead of trusting the aggregation.
    examples: { type: [exampleSchema], default: [] },

    // --- native-capability fields — null for source: "theme-store-trend" ---
    // What paid app category this makes unnecessary, e.g. "Wishlist apps".
    appCategoryReplaced: { type: String, default: null },
    // Whether it's a full app replacement or only partially (see the type's
    // own comment) — required whenever source is "native-capability" at the
    // application layer (scripts/seed-native-capabilities.ts), not enforced
    // by Mongoose since it depends on another field's value.
    nativeCapabilityCompleteness: { type: String, enum: NATIVE_CAPABILITY_COMPLETENESS, default: null },

    sourceName: { type: String, default: "Shopify Theme Store release notes" },
    sourceUrl: { type: String, default: "https://themes.shopify.com/themes" },

    status: { type: String, required: true, enum: ENHANCEMENT_STATUSES, default: "backlog", index: true },
    notes: { type: String, default: null },
  },
  { timestamps: true }
);

enhancementPointSchema.index({ adoptionTier: 1, themeCount: -1 });

export type EnhancementPointDoc = InferSchemaType<typeof enhancementPointSchema>;

export const EnhancementPoint =
  models.EnhancementPoint ?? model("EnhancementPoint", enhancementPointSchema);
