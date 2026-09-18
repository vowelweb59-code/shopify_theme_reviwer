import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { Theme } from "@/models/theme";
import { executeAuditRun } from "@/lib/audit/executeAuditRun";
import type { PresetLink } from "@/lib/audit/liveChecks/shared";

const HTTP_URL_RE = /^https?:\/\//i;

/**
 * Parses the `demoStorePresets` form field — the client JSON.stringify()s
 * an array of {label, url} — and falls back to the legacy singular
 * `demoStoreUrl` field (as a single "Demo store"-labeled preset) so an
 * older client/request shape still works exactly as before. Malformed
 * JSON, a non-array, or an entry missing a valid http(s) url is dropped
 * rather than failing the whole request — this is an optional, best-effort
 * input, same as the single-URL field always was.
 */
function parseDemoStorePresets(formData: FormData): PresetLink[] {
  const raw = formData.get("demoStorePresets")?.toString();
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => ({ label: String(entry?.label ?? "").trim(), url: String(entry?.url ?? "").trim() }))
          .filter((p) => p.url && HTTP_URL_RE.test(p.url))
          .map((p, i) => ({ label: p.label || `Preset ${i + 1}`, url: p.url }));
      }
    } catch {
      // malformed JSON — treat as no presets supplied, same as an empty field
    }
  }

  const legacyUrl = formData.get("demoStoreUrl")?.toString().trim();
  if (legacyUrl && HTTP_URL_RE.test(legacyUrl)) return [{ label: "Demo store", url: legacyUrl }];
  return [];
}

export async function POST(request: Request) {
  await connectToDatabase();

  const formData = await request.formData();
  const themeName = formData.get("themeName")?.toString().trim();
  const file = formData.get("file");
  // Only http(s) — never file://, javascript:, etc. — these are fetched
  // server-side via a real browser, not just linked.
  const demoStorePresets = parseDemoStorePresets(formData);

  if (!themeName) {
    return NextResponse.json({ error: "themeName is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A theme ZIP file is required." }, { status: 400 });
  }

  const theme =
    (await Theme.findOne({ name: themeName })) ?? (await Theme.create({ name: themeName }));
  if (theme.sourceFileName !== file.name) {
    theme.sourceFileName = file.name;
    await theme.save();
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const result = await executeAuditRun({ theme, buffer, demoStorePresets });

  if (!result.ok) {
    return NextResponse.json({ theme, auditRun: result.auditRun, error: result.error }, { status: 400 });
  }
  return NextResponse.json({ theme, auditRun: result.auditRun, findings: result.findings }, { status: 201 });
}
