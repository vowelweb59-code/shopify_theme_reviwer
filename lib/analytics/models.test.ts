import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { AnalyticsSync } from "@/models/analytics-sync";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AGGREGATE_BREAKDOWNS, PRIMARY_EVENTS, TRACKED_EVENTS, buildDimsKey } from "./constants";

// Schema-level checks (validate() + declared indexes) — no MongoDB
// connection needed, so these run in CI and without Docker.

// Field paths that failed validation, sorted ([] when the document is valid).
async function invalidPaths(doc: { validate(): Promise<void> }): Promise<string[]> {
  try {
    await doc.validate();
    return [];
  } catch (err) {
    return Object.keys((err as { errors?: object }).errors ?? {}).sort();
  }
}

function indexKeys(model: { schema: { indexes(): [Record<string, unknown>, Record<string, unknown>][] } }) {
  return model.schema.indexes();
}

describe("buildDimsKey", () => {
  it("uses only the breakdown's own dimensions, in fixed order", () => {
    expect(buildDimsKey("acquisition", { sessionMedium: "cpc", sessionSource: "google", country: "India" })).toBe(
      "sessionSource=google|sessionMedium=cpc|sessionCampaignName="
    );
  });

  it("is empty for the total breakdown", () => {
    expect(buildDimsKey("total", { country: "India" })).toBe("");
  });
});

describe("event constants", () => {
  it("tracks exactly the two primary events", () => {
    expect([...TRACKED_EVENTS].sort()).toEqual([PRIMARY_EVENTS.tryTheme, PRIMARY_EVENTS.themeInstall].sort());
  });
});

describe("AnalyticsTheme", () => {
  it("defaults a new theme to unmapped and active", async () => {
    const doc = new AnalyticsTheme({ name: "Adorn", slug: "adorn" });
    expect(await invalidPaths(doc)).toEqual([]);
    expect(doc.connectionStatus).toBe("unmapped");
    expect(doc.isActive).toBe(true);
    expect(doc.ga4PropertyId).toBeNull();
  });

  it("rejects a malformed property id, slug, or status", async () => {
    expect(await invalidPaths(new AnalyticsTheme({ name: "X", slug: "Not A Slug!", ga4PropertyId: "properties/123", connectionStatus: "nope" }))).toEqual(["connectionStatus", "ga4PropertyId", "slug"]);
  });

  it("allows many unmapped themes but one theme per property", () => {
    const propertyIndex = indexKeys(AnalyticsTheme).find(([keys]) => "ga4PropertyId" in keys);
    expect(propertyIndex?.[1]).toMatchObject({ unique: true, partialFilterExpression: { ga4PropertyId: { $type: "string" } } });
    expect(indexKeys(AnalyticsTheme).some(([keys, opts]) => "slug" in keys && opts.unique)).toBe(true);
  });
});

describe("GoogleConnection", () => {
  it("requires the stable Google account id and email", async () => {
    expect(await invalidPaths(new GoogleConnection({}))).toEqual(["email", "googleAccountId"]);
  });

  it("hides tokens from queries unless explicitly selected", () => {
    expect(GoogleConnection.schema.path("encryptedAccessToken").options.select).toBe(false);
    expect(GoogleConnection.schema.path("encryptedRefreshToken").options.select).toBe(false);
  });

  it("keeps each account as its own row", () => {
    expect(indexKeys(GoogleConnection).some(([keys, opts]) => "googleAccountId" in keys && opts.unique)).toBe(true);
  });
});

describe("AnalyticsSync", () => {
  const base = { analyticsThemeId: new Types.ObjectId(), ga4PropertyId: "123456789", syncType: "initial", rangeStart: "2024-01-01", rangeEnd: "2026-09-23" };

  it("accepts a valid queued job", async () => {
    const doc = new AnalyticsSync({ ...base, isActive: true });
    expect(await invalidPaths(doc)).toEqual([]);
    expect(doc.status).toBe("queued");
  });

  it("rejects unknown sync types and non-ISO dates", async () => {
    expect(await invalidPaths(new AnalyticsSync({ ...base, syncType: "hourly", rangeStart: "01/01/2024" }))).toEqual(["rangeStart", "syncType"]);
  });

  it("declares the per-theme active-job lock", () => {
    const lock = indexKeys(AnalyticsSync).find(([, opts]) => opts.partialFilterExpression);
    expect(lock).toEqual([{ analyticsThemeId: 1 }, expect.objectContaining({ unique: true, partialFilterExpression: { isActive: true } })]);
  });
});

describe("AnalyticsAggregate", () => {
  const base = { analyticsThemeId: new Types.ObjectId(), ga4PropertyId: "123456789", date: "2026-09-23", eventName: PRIMARY_EVENTS.tryTheme };

  it("accepts a row for every declared breakdown", async () => {
    for (const breakdown of Object.keys(AGGREGATE_BREAKDOWNS)) {
      expect(await invalidPaths(new AnalyticsAggregate({ ...base, breakdown }))).toEqual([]);
    }
  });

  it("rejects an unknown breakdown and negative metrics", async () => {
    expect(await invalidPaths(new AnalyticsAggregate({ ...base, breakdown: "weather", metrics: { eventCount: -1 } }))).toEqual(["breakdown", "metrics.eventCount"]);
  });

  it("stores only the row's own dimensions, with no null placeholders", () => {
    const doc = new AnalyticsAggregate({ ...base, breakdown: "country", dims: { country: "India" } });
    expect(doc.toObject().dims).toEqual({ country: "India" });
    expect(Object.keys(doc.toObject().metrics)).toEqual(["eventCount"]);
  });

  it("makes re-synced rows upsert instead of duplicating", () => {
    const identity = indexKeys(AnalyticsAggregate).find(([, opts]) => opts.name === "aggregate_row_identity");
    expect(Object.keys(identity?.[0] ?? {})).toEqual(["analyticsThemeId", "date", "breakdown", "eventName", "dimsKey"]);
    expect(identity?.[1].unique).toBe(true);
  });
});
