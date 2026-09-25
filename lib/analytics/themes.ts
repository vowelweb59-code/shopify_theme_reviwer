import "server-only";
import { AnalyticsTheme } from "@/models/analytics-theme";
import { GoogleConnection } from "@/models/google-connection";
import { Theme } from "@/models/theme";
import { isValidObjectId } from "@/lib/api/validation";
import { GA4_PROPERTY_ID_PATTERN } from "./constants";
import { slugify } from "./slug";
import { Ga4ConnectionError, getAuthorizedClient, markConnectionRevoked } from "./googleConnections";
import { Ga4PropertyError, createAdminApi, getPropertyDetails, listAccessibleProperties, type AdminApi, type Ga4PropertyDetails, type Ga4PropertySummary } from "./properties";

// GA4 themes: CRUD plus the Theme → GA4 property mapping. A mapping is only
// saved after the chosen Google account has proved it can read the
// property. Callers must have run connectToDatabase() first.

/** Thrown for anything the API should answer with a 4xx/5xx and a message. */
export class ThemeRequestError extends Error {
  constructor(
    public readonly status: 400 | 404 | 409 | 422 | 502 | 503,
    message: string
  ) {
    super(message);
    this.name = "ThemeRequestError";
  }
}

/** How an Admin API client is obtained for a connection. Injectable for tests. */
export type AdminResolver = (connectionId: string) => Promise<AdminApi>;
const defaultResolver: AdminResolver = async (connectionId) => createAdminApi(await getAuthorizedClient(connectionId));

export type PublicAnalyticsTheme = {
  id: string;
  name: string;
  slug: string;
  auditThemeId: string | null;
  account: { id: string; email: string; status: string } | null;
  ga4PropertyId: string | null;
  ga4PropertyDisplayName: string | null;
  ga4PropertyTimeZone: string | null;
  connectionStatus: string;
  isActive: boolean;
  lastValidatedAt: string | null;
  lastError: string | null;
  historyStartDate: string | null;
  syncedThroughDate: string | null;
  lastSuccessfulSyncAt: string | null;
};

type ThemeLean = {
  _id: { toString(): string };
  name: string;
  slug: string;
  themeId?: { toString(): string } | null;
  googleConnectionId?: { toString(): string } | null;
  ga4PropertyId?: string | null;
  ga4PropertyDisplayName?: string | null;
  ga4PropertyTimeZone?: string | null;
  connectionStatus: string;
  isActive: boolean;
  lastValidatedAt?: Date | null;
  lastError?: string | null;
  historyStartDate?: string | null;
  syncedThroughDate?: string | null;
  lastSuccessfulSyncAt?: Date | null;
};

type AccountLean = { _id: { toString(): string }; email: string; status: string };

function toPublicTheme(doc: ThemeLean, accounts: Map<string, AccountLean>): PublicAnalyticsTheme {
  const account = doc.googleConnectionId ? accounts.get(doc.googleConnectionId.toString()) : undefined;
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    auditThemeId: doc.themeId?.toString() ?? null,
    account: account ? { id: account._id.toString(), email: account.email, status: account.status } : null,
    ga4PropertyId: doc.ga4PropertyId ?? null,
    ga4PropertyDisplayName: doc.ga4PropertyDisplayName ?? null,
    ga4PropertyTimeZone: doc.ga4PropertyTimeZone ?? null,
    connectionStatus: doc.connectionStatus,
    isActive: doc.isActive,
    lastValidatedAt: doc.lastValidatedAt ? new Date(doc.lastValidatedAt).toISOString() : null,
    lastError: doc.lastError ?? null,
    historyStartDate: doc.historyStartDate ?? null,
    syncedThroughDate: doc.syncedThroughDate ?? null,
    lastSuccessfulSyncAt: doc.lastSuccessfulSyncAt ? new Date(doc.lastSuccessfulSyncAt).toISOString() : null,
  };
}

async function withAccounts(docs: ThemeLean[]): Promise<PublicAnalyticsTheme[]> {
  const ids = [...new Set(docs.map((d) => d.googleConnectionId?.toString()).filter(Boolean))];
  const accounts = await GoogleConnection.find({ _id: { $in: ids } }).select("email status").lean<AccountLean[]>();
  const byId = new Map(accounts.map((a) => [a._id.toString(), a]));
  return docs.map((d) => toPublicTheme(d, byId));
}

async function getPublicTheme(id: string): Promise<PublicAnalyticsTheme> {
  const doc = await AnalyticsTheme.findById(id).lean<ThemeLean>();
  if (!doc) throw new ThemeRequestError(404, "Theme not found.");
  return (await withAccounts([doc]))[0];
}

export async function listThemes(): Promise<PublicAnalyticsTheme[]> {
  return withAccounts(await AnalyticsTheme.find().sort({ name: 1 }).lean<ThemeLean[]>());
}

export { slugify } from "./slug";

/** Accepts "123456789" or GA4's own "properties/123456789" form. */
export function normalizePropertyId(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const id = input.trim().replace(/^properties\//, "");
  return GA4_PROPERTY_ID_PATTERN.test(id) ? id : null;
}

export type ThemeInput = { name?: unknown; googleConnectionId?: unknown; ga4PropertyId?: unknown };
type ParsedMapping = { googleConnectionId: string; ga4PropertyId: string } | null;

function parseName(raw: unknown): string {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name || name.length > 80) throw new ThemeRequestError(400, "Theme name is required (up to 80 characters).");
  if (!slugify(name)) throw new ThemeRequestError(400, "Theme name needs at least one letter or number.");
  return name;
}

/** Both fields or neither: a property can only be read through a specific account. */
function parseMapping(input: ThemeInput): ParsedMapping {
  const hasConnection = input.googleConnectionId !== undefined && input.googleConnectionId !== null && input.googleConnectionId !== "";
  const hasProperty = input.ga4PropertyId !== undefined && input.ga4PropertyId !== null && input.ga4PropertyId !== "";
  if (!hasConnection && !hasProperty) return null;
  if (!hasConnection || !hasProperty) throw new ThemeRequestError(400, "Choose both a Google account and a GA4 property.");
  if (!isValidObjectId(input.googleConnectionId as string)) throw new ThemeRequestError(400, "Google account id is not valid.");
  const ga4PropertyId = normalizePropertyId(input.ga4PropertyId);
  if (!ga4PropertyId) throw new ThemeRequestError(400, "GA4 property id must be the numeric id, e.g. 123456789.");
  return { googleConnectionId: input.googleConnectionId as string, ga4PropertyId };
}

const PROPERTY_ERROR_STATUS: Record<Ga4PropertyError["code"], ThemeRequestError["status"]> = {
  not_found: 422,
  permission_denied: 422,
  auth_revoked: 422,
  api_disabled: 503,
  unavailable: 502,
};

/**
 * Proves `googleConnectionId` can read `ga4PropertyId` and that no other
 * theme already uses it. Returns the property's details to store.
 */
async function checkMapping(mapping: NonNullable<ParsedMapping>, resolveAdmin: AdminResolver, excludeThemeId?: string): Promise<Ga4PropertyDetails> {
  const taken = await AnalyticsTheme.findOne({ ga4PropertyId: mapping.ga4PropertyId, ...(excludeThemeId ? { _id: { $ne: excludeThemeId } } : {}) })
    .select("name")
    .lean<{ name: string }>();
  if (taken) throw new ThemeRequestError(409, `GA4 property ${mapping.ga4PropertyId} is already mapped to ${taken.name}.`);

  const connection = await GoogleConnection.findById(mapping.googleConnectionId).select("email status").lean<AccountLean>();
  if (!connection) throw new ThemeRequestError(422, "That Google account isn't connected.");
  if (connection.status !== "active") throw new ThemeRequestError(422, `${connection.email} needs to be reconnected first.`);

  try {
    return await getPropertyDetails(await resolveAdmin(mapping.googleConnectionId), mapping.ga4PropertyId);
  } catch (err) {
    if (err instanceof Ga4ConnectionError) throw new ThemeRequestError(422, err.message);
    if (err instanceof Ga4PropertyError) {
      if (err.code === "auth_revoked") await markConnectionRevoked(mapping.googleConnectionId);
      throw new ThemeRequestError(PROPERTY_ERROR_STATUS[err.code], err.message);
    }
    throw err;
  }
}

function mappedFields(mapping: NonNullable<ParsedMapping>, details: Ga4PropertyDetails) {
  return {
    googleConnectionId: mapping.googleConnectionId,
    ga4PropertyId: mapping.ga4PropertyId,
    ga4PropertyDisplayName: details.displayName,
    ga4PropertyTimeZone: details.timeZone,
    connectionStatus: "connected",
    lastValidatedAt: new Date(),
    lastError: null,
  };
}

// Sync bookkeeping belongs to one property; a different (or no) property
// means Phase 4 must start that theme's history over.
const RESET_SYNC_STATE = { historyStartDate: null, syncedThroughDate: null, lastSuccessfulSyncAt: null };

const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

async function findAuditThemeId(name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = await Theme.findOne({ name: new RegExp(`^${escaped}$`, "i") }).select("_id").lean<{ _id: unknown }>();
  return match?._id ?? null;
}

export async function createTheme(input: ThemeInput, resolveAdmin: AdminResolver = defaultResolver): Promise<PublicAnalyticsTheme> {
  const name = parseName(input.name);
  const slug = slugify(name);
  const mapping = parseMapping(input);

  const existing = await AnalyticsTheme.findOne({ slug }).select("name").lean<{ name: string }>();
  if (existing) throw new ThemeRequestError(409, `A theme called ${existing.name} already exists.`);

  const details = mapping ? await checkMapping(mapping, resolveAdmin) : null;
  try {
    const doc = await AnalyticsTheme.create({
      name,
      slug,
      themeId: await findAuditThemeId(name),
      ...(mapping && details ? mappedFields(mapping, details) : {}),
    });
    return getPublicTheme(doc._id.toString());
  } catch (err) {
    if (isDuplicateKey(err)) throw new ThemeRequestError(409, "That theme or GA4 property was just added by someone else. Refresh and try again.");
    throw err;
  }
}

/** Rename and/or (re)map. The slug never changes, so it stays a stable identifier. */
export async function updateTheme(id: string, input: ThemeInput, resolveAdmin: AdminResolver = defaultResolver): Promise<PublicAnalyticsTheme> {
  const current = await AnalyticsTheme.findById(id).select("ga4PropertyId").lean<{ ga4PropertyId?: string | null }>();
  if (!current) throw new ThemeRequestError(404, "Theme not found.");

  const set: Record<string, unknown> = {};
  if (input.name !== undefined) set.name = parseName(input.name);
  const mapping = parseMapping(input);
  if (mapping) {
    Object.assign(set, mappedFields(mapping, await checkMapping(mapping, resolveAdmin, id)));
    if (mapping.ga4PropertyId !== current.ga4PropertyId) Object.assign(set, RESET_SYNC_STATE);
  }
  if (Object.keys(set).length === 0) throw new ThemeRequestError(400, "Nothing to update.");

  try {
    await AnalyticsTheme.updateOne({ _id: id }, { $set: set }, { runValidators: true });
  } catch (err) {
    if (isDuplicateKey(err)) throw new ThemeRequestError(409, "That GA4 property was just mapped to another theme.");
    throw err;
  }
  return getPublicTheme(id);
}

/**
 * Re-checks a saved mapping. A permanent failure marks the theme "error";
 * a transient one (Google unreachable) only records lastError.
 */
export async function validateTheme(id: string, resolveAdmin: AdminResolver = defaultResolver): Promise<{ ok: boolean; theme: PublicAnalyticsTheme }> {
  const doc = await AnalyticsTheme.findById(id).select("googleConnectionId ga4PropertyId").lean<ThemeLean>();
  if (!doc) throw new ThemeRequestError(404, "Theme not found.");
  if (!doc.googleConnectionId || !doc.ga4PropertyId) throw new ThemeRequestError(400, "This theme has no GA4 property to validate.");

  const mapping = { googleConnectionId: doc.googleConnectionId.toString(), ga4PropertyId: doc.ga4PropertyId };
  try {
    const details = await checkMapping(mapping, resolveAdmin, id);
    await AnalyticsTheme.updateOne({ _id: id }, { $set: mappedFields(mapping, details) });
    return { ok: true, theme: await getPublicTheme(id) };
  } catch (err) {
    if (!(err instanceof ThemeRequestError)) throw err;
    const transient = err.status === 502;
    await AnalyticsTheme.updateOne(
      { _id: id },
      { $set: { lastError: err.message, ...(transient ? {} : { connectionStatus: "error", lastValidatedAt: new Date() }) } }
    );
    return { ok: false, theme: await getPublicTheme(id) };
  }
}

/** Removes the theme's GA4 mapping. The theme itself (and later its history) stays. */
export async function disconnectTheme(id: string): Promise<PublicAnalyticsTheme> {
  const result = await AnalyticsTheme.updateOne(
    { _id: id },
    {
      $set: {
        googleConnectionId: null,
        ga4PropertyId: null,
        ga4PropertyDisplayName: null,
        ga4PropertyTimeZone: null,
        connectionStatus: "unmapped",
        lastValidatedAt: null,
        lastError: null,
        ...RESET_SYNC_STATE,
      },
    }
  );
  if (result.matchedCount === 0) throw new ThemeRequestError(404, "Theme not found.");
  return getPublicTheme(id);
}

export type DiscoveredProperty = Ga4PropertySummary & { mappedToTheme: { id: string; name: string } | null };

/** Properties a connected account can see, each flagged if a theme already uses it. */
export async function discoverProperties(connectionId: string, resolveAdmin: AdminResolver = defaultResolver): Promise<DiscoveredProperty[]> {
  const connection = await GoogleConnection.findById(connectionId).select("email status").lean<AccountLean>();
  if (!connection) throw new ThemeRequestError(404, "Google account not found.");
  if (connection.status !== "active") throw new ThemeRequestError(422, `${connection.email} needs to be reconnected first.`);

  let properties: Ga4PropertySummary[];
  try {
    properties = await listAccessibleProperties(await resolveAdmin(connectionId));
  } catch (err) {
    if (err instanceof Ga4ConnectionError) throw new ThemeRequestError(422, err.message);
    if (err instanceof Ga4PropertyError) {
      if (err.code === "auth_revoked") await markConnectionRevoked(connectionId);
      throw new ThemeRequestError(PROPERTY_ERROR_STATUS[err.code], err.message);
    }
    throw err;
  }

  const mapped = await AnalyticsTheme.find({ ga4PropertyId: { $in: properties.map((p) => p.propertyId) } })
    .select("name ga4PropertyId")
    .lean<{ _id: { toString(): string }; name: string; ga4PropertyId: string }[]>();
  const byProperty = new Map(mapped.map((t) => [t.ga4PropertyId, { id: t._id.toString(), name: t.name }]));
  return properties.map((p) => ({ ...p, mappedToTheme: byProperty.get(p.propertyId) ?? null }));
}
