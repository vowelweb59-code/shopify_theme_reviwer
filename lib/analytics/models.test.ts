import { describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { AnalyticsSync } from "@/models/analytics-sync";
import { AnalyticsAggregate } from "@/models/analytics-aggregate";
import { AnalyticsRangeUsers } from "@/models/analytics-range-users";
import { AGGREGATE_BREAKDOWNS, ALL_EVENTS, PRIMARY_EVENTS, TRACKED_EVENTS, buildDimsKey } from "./constants";

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

  it("keys city rows by country too, so same-named cities stay distinct", () => {
    expect(buildDimsKey("city", { country: "US", city: "Paris" })).not.toBe(buildDimsKey("city", { country: "France", city: "Paris" }));
  });
});

describe("event constants", () => {
  it("tracks both primary events exactly once", () => {
    expect(TRACKED_EVENTS.filter((e) => e === PRIMARY_EVENTS.themeInstall)).toHaveLength(1);
    expect(TRACKED_EVENTS.filter((e) => e === PRIMARY_EVENTS.tryTheme)).toHaveLength(1);
  });

  it("ALL_EVENTS can't collide with a real GA4 event name", () => {
    expect(/^[A-Za-z][A-Za-z0-9_]*$/.test(ALL_EVENTS)).toBe(false);
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

  it("makes re-synced rows upsert instead of duplicating", () => {
    const identity = indexKeys(AnalyticsAggregate).find(([, opts]) => opts.name === "aggregate_row_identity");
    expect(Object.keys(identity?.[0] ?? {})).toEqual(["analyticsThemeId", "date", "breakdown", "eventName", "dimsKey"]);
    expect(identity?.[1].unique).toBe(true);
  });
});

describe("AnalyticsRangeUsers", () => {
  it("is keyed per theme, property and query, and expires on its own", () => {
    const indexes = indexKeys(AnalyticsRangeUsers);
    expect(indexes).toContainEqual([{ analyticsThemeId: 1, ga4PropertyId: 1, cacheKey: 1 }, expect.objectContaining({ unique: true })]);
    expect(indexes).toContainEqual([{ expiresAt: 1 }, expect.objectContaining({ expireAfterSeconds: 0 })]);
  });

  it("requires an expiry and rejects negative user counts", async () => {
    const doc = new AnalyticsRangeUsers({ analyticsThemeId: new Types.ObjectId(), ga4PropertyId: "123456789", cacheKey: "k", groups: [{ key: "", users: -1 }] });
    expect(await invalidPaths(doc)).toEqual(["expiresAt", "groups.0.users"]);
  });
});
