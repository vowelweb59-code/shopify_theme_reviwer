import "server-only";
import { google, type Auth, type analyticsdata_v1beta } from "googleapis";
import { googleErrorCode } from "../googleOAuth";

// GA4 Data API access for the sync pipeline: one report request, fully
// paginated, with short in-request retries for momentary failures. Longer
// outages and quota exhaustion are the job runner's to handle (it
// reschedules the whole job) — see runSync.ts. Server-side only.

export type DataApi = { properties: Pick<analyticsdata_v1beta.Resource$Properties, "runReport"> };
export type ReportRequest = analyticsdata_v1beta.Schema$RunReportRequest;
export type ReportRow = { dimensions: string[]; metrics: number[] };

export function createDataApi(auth: Auth.OAuth2Client): DataApi {
  return google.analyticsdata({ version: "v1beta", auth });
}

export type Ga4DataErrorCode =
  | "quota_hourly" // property's hourly token quota — resume in about an hour
  | "quota_daily" // property's daily token quota — resume tomorrow
  | "rate_limited" // concurrency / generic 429 — resume shortly
  | "unavailable" // network, timeout, Google 5xx
  | "auth_revoked"
  | "permission_denied"
  | "api_disabled" // Google Analytics Data API not enabled in the Cloud project
  | "not_found"
  | "invalid_request"; // our request is wrong (e.g. incompatible dimensions) — a bug, never retried

const RETRYABLE = new Set<Ga4DataErrorCode>(["quota_hourly", "quota_daily", "rate_limited", "unavailable"]);

export class Ga4DataError extends Error {
  constructor(
    public readonly code: Ga4DataErrorCode,
    message: string
  ) {
    super(message);
    this.name = "Ga4DataError";
  }

  get retryable(): boolean {
    return RETRYABLE.has(this.code);
  }
}

/** Maps a googleapis failure to a safe Ga4DataError. Google's raw text is only matched, never surfaced. */
export function classifyDataApiError(err: unknown): Ga4DataError {
  if (err instanceof Ga4DataError) return err;
  if (googleErrorCode(err) === "invalid_grant") return new Ga4DataError("auth_revoked", "Google revoked this account's access. Reconnect it.");

  const e = err as { status?: number; code?: number | string; message?: string };
  const status = e.status ?? (typeof e.code === "number" ? e.code : undefined);
  const message = e.message ?? "";

  if (status === 429 || /RESOURCE_EXHAUSTED/.test(message)) {
    if (/per day/i.test(message)) return new Ga4DataError("quota_daily", "GA4's daily API quota for this property is used up; the sync will resume tomorrow.");
    if (/per hour/i.test(message)) return new Ga4DataError("quota_hourly", "GA4's hourly API quota for this property is used up; the sync will resume within the hour.");
    return new Ga4DataError("rate_limited", "GA4 is rate-limiting requests; the sync will retry shortly.");
  }
  if (status === 401) return new Ga4DataError("auth_revoked", "Google rejected this account's access. Reconnect it.");
  if (status === 403 && /SERVICE_DISABLED|has not been used|is disabled/i.test(message)) {
    return new Ga4DataError("api_disabled", "The Google Analytics Data API isn't enabled in this app's Google Cloud project.");
  }
  if (status === 403) return new Ga4DataError("permission_denied", "This Google account can no longer read the theme's GA4 property.");
  if (status === 404) return new Ga4DataError("not_found", "The theme's GA4 property no longer exists.");
  if (status === 400) return new Ga4DataError("invalid_request", "GA4 rejected the report request (an app bug, not a data problem).");
  return new Ga4DataError("unavailable", "Couldn't reach Google Analytics.");
}

const PAGE_SIZE = 100_000; // the Data API's maximum
const IN_REQUEST_ATTEMPTS = 3;

export type ReportResult = { rows: ReportRow[]; subjectToThresholding: boolean; dataLossFromOtherRow: boolean };

export type ClientOptions = { sleep?: (ms: number) => Promise<void> };
const realSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, sleep: (ms: number) => Promise<void>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (raw) {
      const err = classifyDataApiError(raw);
      // Only brief blips are retried here; quota waits are hours long and
      // belong to the job scheduler.
      const momentary = err.code === "unavailable" || err.code === "rate_limited";
      if (!momentary || attempt >= IN_REQUEST_ATTEMPTS) throw err;
      await sleep(1000 * 2 ** (attempt - 1) + Math.random() * 250);
    }
  }
}

/** Runs one report over every page of results. Metric values come back as numbers. */
export async function runFullReport(api: DataApi, propertyId: string, request: ReportRequest, options: ClientOptions = {}): Promise<ReportResult> {
  const sleep = options.sleep ?? realSleep;
  const rows: ReportRow[] = [];
  let subjectToThresholding = false;
  let dataLossFromOtherRow = false;

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await withRetry(
      () => api.properties.runReport({ property: `properties/${propertyId}`, requestBody: { ...request, limit: String(PAGE_SIZE), offset: String(offset) } }),
      sleep
    );
    for (const row of data.rows ?? []) {
      rows.push({
        dimensions: (row.dimensionValues ?? []).map((v) => v.value ?? ""),
        metrics: (row.metricValues ?? []).map((v) => Number(v.value ?? 0) || 0),
      });
    }
    subjectToThresholding ||= Boolean(data.metadata?.subjectToThresholding);
    dataLossFromOtherRow ||= Boolean(data.metadata?.dataLossFromOtherRow);
    if (offset + PAGE_SIZE >= (data.rowCount ?? 0)) break;
  }
  return { rows, subjectToThresholding, dataLossFromOtherRow };
}
