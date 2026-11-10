import "server-only";
import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";

// Route-handler plumbing for /api/service/*. Business logic lives in lib/service/api/<area>.ts as plain async functions
// (called directly by the server pages too); route.ts files only parse the request and wrap the call with `handle`.

/** A failure the caller should see: 400 (bad input), 404 (missing), 409 (conflict). */
export class ServiceError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "ServiceError";
  }
}

export const badRequest = (message: string) => new ServiceError(400, message);
export const notFound = (what = "Not found") => new ServiceError(404, what);

export async function handle<T>(fn: () => Promise<T>, status = 200): Promise<NextResponse> {
  try {
    await connectToDatabase();
    return NextResponse.json(await fn(), { status });
  } catch (err) {
    if (err instanceof ServiceError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error("[service api]", err instanceof Error ? err.stack ?? err.message : err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw badRequest("A JSON object body is required.");
  return body as Record<string, unknown>;
}

/** Calls a lib/service/api function from a server page, after connecting. A ServiceError 404 becomes the not-found page. */
export async function load<T>(fn: () => Promise<T>): Promise<T> {
  await connectToDatabase();
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ServiceError && err.status === 404) {
      const { notFound: nf } = await import("next/navigation");
      nf();
    }
    throw err;
  }
}

// --- small input readers (no zod in this app) -------------------------------------------------------------------------

export function str(v: unknown, field: string, { max = 200, optional = false } = {}): string | null {
  if (v === undefined || v === null || v === "") {
    if (optional) return null;
    throw badRequest(`${field} is required.`);
  }
  if (typeof v !== "string") throw badRequest(`${field} must be text.`);
  const t = v.trim();
  if (!t && !optional) throw badRequest(`${field} is required.`);
  if (t.length > max) throw badRequest(`${field} is too long (max ${max} characters).`);
  return t || null;
}

export function int(v: unknown, field: string, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}): number | null {
  if (v === undefined || v === null || v === "") {
    if (optional) return null;
    throw badRequest(`${field} is required.`);
  }
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw badRequest(`${field} must be a whole number between ${min} and ${max}.`);
  return n;
}

export function bool(v: unknown, field: string): boolean {
  if (typeof v !== "boolean") throw badRequest(`${field} must be true or false.`);
  return v;
}

export function isoDay(v: unknown, field: string, { optional = true } = {}): Date | null {
  if (v === undefined || v === null || v === "") {
    if (optional) return null;
    throw badRequest(`${field} is required.`);
  }
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`))) throw badRequest(`${field} must be a date (YYYY-MM-DD).`);
  return new Date(`${v}T00:00:00Z`);
}

export function oneOf<T extends string>(v: unknown, field: string, options: readonly T[]): T {
  if (typeof v !== "string" || !(options as readonly string[]).includes(v)) throw badRequest(`${field} must be one of: ${options.join(", ")}.`);
  return v as T;
}

export function strList(v: unknown, field: string, { max = 50, each = 120 } = {}): string[] {
  if (!Array.isArray(v)) throw badRequest(`${field} must be a list.`);
  if (v.length > max) throw badRequest(`${field} has too many items (max ${max}).`);
  const out = v.map((x) => str(x, field, { max: each })!).filter(Boolean);
  return [...new Set(out)];
}

/** Date -> "YYYY-MM-DD" (null stays null). */
export const day = (d: Date | string | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : null);
