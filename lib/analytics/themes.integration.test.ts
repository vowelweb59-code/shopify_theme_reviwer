import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { Theme } from "@/models/theme";
import type { AdminApi } from "./properties";
import { createTheme, disconnectTheme, discoverProperties, listThemes, updateTheme, validateTheme, type AdminResolver } from "./themes";

// Needs a real MongoDB (unique property index, upserts). Opt-in, same as
// googleConnections.integration.test.ts:
//   GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run lib/analytics
const uri = process.env.GA4_TEST_MONGODB_URI;

const httpError = (status: number, message = "") => Object.assign(new Error(message), { status });

// Account A can read these two properties; everything else is a 403.
const PROPERTIES: Record<string, { displayName: string; timeZone: string }> = {
  "111111111": { displayName: "Adorn Demo", timeZone: "Asia/Kolkata" },
  "112112112": { displayName: "Noble Demo", timeZone: "America/New_York" },
};

function resolver(overrides: { getError?: Error } = {}): AdminResolver {
  return async () =>
    ({
      accountSummaries: {
        list: async () => ({
          data: {
            accountSummaries: [
              {
                account: "accounts/1",
                displayName: "VowelWeb",
                propertySummaries: Object.entries(PROPERTIES).map(([id, p]) => ({ property: `properties/${id}`, displayName: p.displayName })),
              },
            ],
          },
        }),
      },
      properties: {
        get: async ({ name }: { name: string }) => {
          if (overrides.getError) throw overrides.getError;
          const property = PROPERTIES[name.replace("properties/", "")];
          if (!property) throw httpError(403, "User does not have sufficient permissions for this property.");
          return { data: { name, ...property, createTime: "2024-01-01T00:00:00Z" } };
        },
      },
    }) as unknown as AdminApi;
}

describe.skipIf(!uri)("GA4 themes (MongoDB)", () => {
  let accountA: string;

  beforeAll(async () => {
    await mongoose.connect(uri!, { dbName: "ga4_test_themes" }); // own DB: test files run in parallel
    await Promise.all([AnalyticsTheme.syncIndexes(), GoogleConnection.syncIndexes()]);
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    await Promise.all([AnalyticsTheme.deleteMany({}), GoogleConnection.deleteMany({}), Theme.deleteMany({})]);
    const conn = await GoogleConnection.create({ googleAccountId: "sub-A", email: "a@example.com", status: "active" });
    accountA = conn._id.toString();
  });

  it("adds an unmapped theme and links the audited theme of the same name", async () => {
    const audit = await Theme.create({ name: "Adorn" });
    const theme = await createTheme({ name: "adorn " }, resolver());
    expect(theme).toMatchObject({ name: "adorn", slug: "adorn", connectionStatus: "unmapped", account: null, auditThemeId: audit._id.toString() });
  });

  it("validates and saves a mapping in one step", async () => {
    const theme = await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "properties/111111111" }, resolver());
    expect(theme).toMatchObject({
      connectionStatus: "connected",
      ga4PropertyId: "111111111",
      ga4PropertyDisplayName: "Adorn Demo",
      ga4PropertyTimeZone: "Asia/Kolkata",
      account: { email: "a@example.com", status: "active" },
    });
  });

  it("saves nothing when the account can't read the property", async () => {
    await expect(createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "999999999" }, resolver())).rejects.toMatchObject({ status: 422 });
    expect(await AnalyticsTheme.countDocuments()).toBe(0);
  });

  it("rejects duplicate names and a property already used by another theme", async () => {
    await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver());
    await expect(createTheme({ name: "ADORN" }, resolver())).rejects.toMatchObject({ status: 409 });
    await expect(createTheme({ name: "Noble", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver())).rejects.toMatchObject({
      status: 409,
      message: expect.stringContaining("Adorn"),
    });
  });

  it("requires account and property together, and a numeric property id", async () => {
    await expect(createTheme({ name: "X", ga4PropertyId: "111111111" }, resolver())).rejects.toMatchObject({ status: 400 });
    await expect(createTheme({ name: "X", googleConnectionId: accountA, ga4PropertyId: "G-ABC" }, resolver())).rejects.toMatchObject({ status: 400 });
    await expect(createTheme({ name: "   " }, resolver())).rejects.toMatchObject({ status: 400 });
  });

  it("won't map through an account that needs reconnecting", async () => {
    await GoogleConnection.updateOne({ _id: accountA }, { status: "revoked" });
    await expect(createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver())).rejects.toMatchObject({
      status: 422,
      message: expect.stringContaining("reconnected"),
    });
  });

  it("changes a theme's property and resets its sync bookkeeping", async () => {
    const theme = await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver());
    await AnalyticsTheme.updateOne({ _id: theme.id }, { syncedThroughDate: "2026-09-20", historyStartDate: "2024-01-01" });

    const renamed = await updateTheme(theme.id, { name: "Adorn Pro" }, resolver());
    expect(renamed).toMatchObject({ name: "Adorn Pro", slug: "adorn", ga4PropertyId: "111111111" });
    expect((await AnalyticsTheme.findById(theme.id).lean<{ syncedThroughDate: string }>())?.syncedThroughDate).toBe("2026-09-20");

    const moved = await updateTheme(theme.id, { googleConnectionId: accountA, ga4PropertyId: "112112112" }, resolver());
    expect(moved).toMatchObject({ ga4PropertyId: "112112112", ga4PropertyDisplayName: "Noble Demo" });
    const doc = await AnalyticsTheme.findById(theme.id).lean<{ syncedThroughDate: string | null; historyStartDate: string | null }>();
    expect(doc).toMatchObject({ syncedThroughDate: null, historyStartDate: null });
  });

  it("re-validation marks access loss as an error, but not a Google outage", async () => {
    const theme = await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver());

    const outage = await validateTheme(theme.id, resolver({ getError: httpError(503) }));
    expect(outage.ok).toBe(false);
    expect(outage.theme.connectionStatus).toBe("connected");
    expect(outage.theme.lastError).toMatch(/Try again/);

    const lost = await validateTheme(theme.id, resolver({ getError: httpError(403, "PERMISSION_DENIED") }));
    expect(lost.theme.connectionStatus).toBe("error");

    const back = await validateTheme(theme.id, resolver());
    expect(back).toMatchObject({ ok: true, theme: { connectionStatus: "connected", lastError: null } });
  });

  it("marks the Google account revoked when Google rejects its token", async () => {
    const theme = await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver());
    await validateTheme(theme.id, resolver({ getError: Object.assign(new Error(), { response: { data: { error: "invalid_grant" } } }) }));
    expect((await GoogleConnection.findById(accountA).lean<{ status: string }>())?.status).toBe("revoked");
    expect((await listThemes())[0].account?.status).toBe("revoked");
  });

  it("disconnect unmaps the theme but keeps it", async () => {
    const theme = await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver());
    const result = await disconnectTheme(theme.id);
    expect(result).toMatchObject({ connectionStatus: "unmapped", ga4PropertyId: null, account: null });
    // The freed property can now be mapped to another theme.
    await expect(createTheme({ name: "Noble", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver())).resolves.toMatchObject({ ga4PropertyId: "111111111" });
  });

  it("discovers properties, flagging the ones already mapped", async () => {
    await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver());
    const properties = await discoverProperties(accountA, resolver());
    expect(properties.map((p) => [p.propertyId, p.mappedToTheme?.name ?? null])).toEqual([
      ["111111111", "Adorn"],
      ["112112112", null],
    ]);
  });

  it("lets themes share a property only with non-overlapping page filters", async () => {
    const adorn = await createTheme({ name: "Adorn", googleConnectionId: accountA, ga4PropertyId: "111111111" }, resolver());
    const mapFlaunt = (pagePathPrefix?: string) => createTheme({ name: "Flaunt", googleConnectionId: accountA, ga4PropertyId: "111111111", pagePathPrefix }, resolver());

    // Adorn has no filter yet, so its property can't be shared.
    await expect(mapFlaunt("/themes/flaunt/")).rejects.toMatchObject({ status: 409, message: expect.stringContaining("page path filter") });

    await AnalyticsTheme.updateOne({ _id: adorn.id }, { syncedThroughDate: "2026-09-20", historyStartDate: "2024-01-01" });
    const filtered = await updateTheme(adorn.id, { pagePathPrefix: " /themes/adorn/ " }, resolver());
    expect(filtered.pagePathPrefix).toBe("/themes/adorn/");
    // A new filter means a new history.
    expect(await AnalyticsTheme.findById(adorn.id).lean<{ syncedThroughDate: string | null }>()).toMatchObject({ syncedThroughDate: null });

    await expect(mapFlaunt()).rejects.toMatchObject({ status: 409 });
    await expect(mapFlaunt("/THEMES/ADORN/presets")).rejects.toMatchObject({ status: 409, message: expect.stringContaining("overlaps") });
    await expect(mapFlaunt("/themes/flaunt/")).resolves.toMatchObject({ ga4PropertyId: "111111111", pagePathPrefix: "/themes/flaunt/" });

    // Removing Adorn's filter would make it swallow Flaunt's pages.
    await expect(updateTheme(adorn.id, { pagePathPrefix: "" }, resolver())).rejects.toMatchObject({ status: 409 });

    const [shared] = await discoverProperties(accountA, resolver());
    expect(shared.mappedThemes.map((t) => [t.name, t.pagePathPrefix])).toEqual([
      ["Adorn", "/themes/adorn/"],
      ["Flaunt", "/themes/flaunt/"],
    ]);
  });

  it("rejects a malformed page filter", async () => {
    await expect(createTheme({ name: "Adorn", pagePathPrefix: "themes/adorn" }, resolver())).rejects.toMatchObject({ status: 400 });
    await expect(createTheme({ name: "Adorn", pagePathPrefix: "/themes/ adorn" }, resolver())).rejects.toMatchObject({ status: 400 });
  });

  it("returns 404 for unknown themes and accounts", async () => {
    const missing = new mongoose.Types.ObjectId().toString();
    await expect(updateTheme(missing, { name: "X" }, resolver())).rejects.toMatchObject({ status: 404 });
    await expect(validateTheme(missing, resolver())).rejects.toMatchObject({ status: 404 });
    await expect(disconnectTheme(missing)).rejects.toMatchObject({ status: 404 });
    await expect(discoverProperties(missing, resolver())).rejects.toMatchObject({ status: 404 });
  });
});

vi.setConfig({ testTimeout: 20_000 });
