import "server-only";
import { analyticsadmin, type analyticsadmin_v1beta } from "@googleapis/analyticsadmin";
import type { OAuth2Client } from "google-auth-library";
import { googleErrorCode } from "./googleOAuth";
import { GOOGLE_API_TIMEOUT_MS } from "@/lib/google/timeouts";

// GA4 Admin API: which properties a connected Google account can see, and
// the details of one property. Read-only (analytics.readonly scope). The
// Data API (actual report numbers) is Phase 4.

export type Ga4PropertySummary = {
  propertyId: string;
  displayName: string;
  accountId: string;
  accountDisplayName: string;
};

export type Ga4PropertyDetails = {
  propertyId: string;
  displayName: string;
  timeZone: string | null;
  createTime: string | null;
};

// Just the two Admin API methods used here, so tests can pass a fake.
export type AdminApi = {
  accountSummaries: Pick<analyticsadmin_v1beta.Resource$Accountsummaries, "list">;
  properties: Pick<analyticsadmin_v1beta.Resource$Properties, "get">;
};

export function createAdminApi(auth: OAuth2Client): AdminApi {
  return analyticsadmin({ version: "v1beta", auth, timeout: GOOGLE_API_TIMEOUT_MS });
}

export class Ga4PropertyError extends Error {
  constructor(
    public readonly code: "not_found" | "permission_denied" | "api_disabled" | "auth_revoked" | "unavailable",
    message: string
  ) {
    super(message);
    this.name = "Ga4PropertyError";
  }
}

const idFrom = (resourceName: string | null | undefined, prefix: string) => (resourceName ?? "").replace(`${prefix}/`, "");

/** Every GA4 property the account can access, across all its Analytics accounts. */
export async function listAccessibleProperties(admin: AdminApi): Promise<Ga4PropertySummary[]> {
  const properties: Ga4PropertySummary[] = [];
  let pageToken: string | undefined;
  try {
    do {
      const { data } = await admin.accountSummaries.list({ pageSize: 200, pageToken });
      for (const account of data.accountSummaries ?? []) {
        for (const property of account.propertySummaries ?? []) {
          // Roll-up and sub-properties are GA360-only and have no event data of their own.
          if (property.propertyType && property.propertyType !== "PROPERTY_TYPE_ORDINARY") continue;
          properties.push({
            propertyId: idFrom(property.property, "properties"),
            displayName: property.displayName ?? "(unnamed property)",
            accountId: idFrom(account.account, "accounts"),
            accountDisplayName: account.displayName ?? "(unnamed account)",
          });
        }
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (err) {
    throw toPropertyError(err);
  }
  return properties.sort((a, b) => a.accountDisplayName.localeCompare(b.accountDisplayName) || a.displayName.localeCompare(b.displayName));
}

/** One property's details; throws Ga4PropertyError when the account can't read it. */
export async function getPropertyDetails(admin: AdminApi, propertyId: string): Promise<Ga4PropertyDetails> {
  try {
    const { data } = await admin.properties.get({ name: `properties/${propertyId}` });
    if (data.deleteTime) throw new Ga4PropertyError("not_found", `GA4 property ${propertyId} is in the trash.`);
    return {
      propertyId,
      displayName: data.displayName ?? "(unnamed property)",
      timeZone: data.timeZone ?? null,
      createTime: data.createTime ?? null,
    };
  } catch (err) {
    throw err instanceof Ga4PropertyError ? err : toPropertyError(err, propertyId);
  }
}

/** Maps a googleapis failure to a safe, user-facing Ga4PropertyError. */
export function toPropertyError(err: unknown, propertyId?: string): Ga4PropertyError {
  if (googleErrorCode(err) === "invalid_grant") {
    return new Ga4PropertyError("auth_revoked", "Google revoked this account's access. Reconnect it under Google accounts.");
  }
  const e = err as { status?: number; code?: number | string; message?: string };
  const status = e.status ?? (typeof e.code === "number" ? e.code : undefined);
  const message = e.message ?? "";
  const what = propertyId ? `GA4 property ${propertyId}` : "GA4 properties";

  if (status === 401) return new Ga4PropertyError("auth_revoked", "Google rejected this account's access. Reconnect it under Google accounts.");
  if (status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(message)) {
    return new Ga4PropertyError("api_disabled", "The Google Analytics Admin API isn't enabled in this app's Google Cloud project.");
  }
  if (status === 403) return new Ga4PropertyError("permission_denied", `This Google account can't access ${what}.`);
  if (status === 404) return new Ga4PropertyError("not_found", `${what} doesn't exist.`);
  return new Ga4PropertyError("unavailable", `Couldn't reach Google Analytics to read ${what}. Try again shortly.`);
}
