import ExcelJS from "exceljs";

// Reads a Shopify Partner theme-sales export (the user's sheet, downloaded
// as .xlsx or .csv, or copied as tab-separated text). Columns are found by
// header name, not position, so reordered or extra columns are fine:
//   Date | Shop Name | Shop Domain | Preset | … | Country | Charge Type | Sale | Fee | Share
// Rows without a valid date or shop domain are skipped (the user's sheet
// starts with a few undated reference rows of store URLs).

export type ParsedSale = {
  soldAt: Date;
  month: string;
  shopName: string;
  shopDomain: string;
  country: string;
  chargeType: string;
  amount: number;
  fee: number;
  share: number;
  sheetPreset: string;
  sheetPresetAlt: string;
};

export type ParseResult = { sales: ParsedSale[]; skipped: number; headerRow: number };

export class SalesFileError extends Error {}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "sale date", "created at", "charge date"],
  shopName: ["shop name", "store name", "shop"],
  shopDomain: ["shop domain", "store domain", "domain", "store url", "shop url", "myshopify domain"],
  preset: ["preset", "theme preset", "style"],
  country: ["country", "shop country"],
  chargeType: ["charge type", "type"],
  amount: ["sale", "amount", "price", "gross"],
  fee: ["fee", "fees"],
  share: ["share", "net", "payout", "your share"],
};

function norm(s: unknown): string {
  return String(s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Splits CSV/TSV text into rows, honouring "quoted, fields" and escaped "" quotes. */
export function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/\t/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? "\t" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export type WorkbookSheet = { name: string; rows: string[][] };

/** Every tab of an .xlsx, in order, as rows of cell text. */
export async function readWorkbook(buffer: Buffer): Promise<WorkbookSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  if (workbook.worksheets.length === 0) throw new SalesFileError("The workbook has no sheets.");
  return workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (r) => {
      const cells: string[] = [];
      for (let c = 1; c <= r.cellCount; c++) {
        const cell = r.getCell(c);
        const v = cell.value;
        cells.push(v instanceof Date ? v.toISOString() : cell.text ?? "");
      }
      rows.push(cells);
    });
    return { name: sheet.name, rows };
  });
}

export function isXlsx(buffer: Buffer, fileName: string): boolean {
  return /\.xlsx$/i.test(fileName) || (buffer[0] === 0x50 && buffer[1] === 0x4b); // "PK" zip header
}

/**
 * The theme a tab belongs to, by its name: an exact match ignoring case,
 * spaces and punctuation ("adorn", "ADORN "), else a theme name that
 * appears as a whole word in the tab name ("Adorn sales 2026").
 */
export function matchThemeForTab<T extends { name: string }>(tabName: string, themes: T[]): T | null {
  const squash = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const exact = themes.find((t) => squash(t.name) === squash(tabName));
  if (exact) return exact;
  const words = tabName.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  const partial = themes.filter((t) => words.includes(t.name.toLowerCase()));
  return partial.length === 1 ? partial[0] : null;
}

/** "https://www.Store.com/password" or "store.myshopify.com" -> "store.myshopify.com" / "www.store.com". */
export function normalizeDomain(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return "";
  try {
    const url = new URL(/^[a-z]+:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`);
    return url.hostname;
  } catch {
    return "";
  }
}

/** "2026-07-30 12:31:51 UTC", "2026-07-30", or an ISO string -> Date (UTC). */
export function parseSaleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const iso = s.replace(/\s*UTC$/i, "Z").replace(/^(\d{4}-\d{2}-\d{2})\s+/, "$1T");
  const withZone = /T/.test(iso) && !/(Z|[+-]\d{2}:?\d{2})$/.test(iso) ? `${iso}Z` : iso;
  const d = new Date(/T/.test(withZone) ? withZone : `${withZone}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseMoney(raw: string | undefined): number {
  const n = Number(String(raw ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function normalizeChargeType(raw: string): string {
  const t = norm(raw);
  if (!t || t === "theme sale" || t === "sale") return "sale";
  if (t.includes("refund")) return "refund";
  return t;
}

export function salesFromRows(rows: string[][]): ParseResult {
  const headerRow = rows.findIndex((r) => {
    const cells = r.map(norm);
    return HEADER_ALIASES.date.some((a) => cells.includes(a)) && HEADER_ALIASES.shopDomain.some((a) => cells.includes(a));
  });
  if (headerRow === -1) throw new SalesFileError('Couldn\'t find the header row — the sheet needs at least a "Date" and a "Shop Domain" column.');

  const headers = rows[headerRow].map(norm);
  const col = (field: string) => headers.findIndex((h) => HEADER_ALIASES[field].includes(h));
  const idx = Object.fromEntries(Object.keys(HEADER_ALIASES).map((f) => [f, col(f)])) as Record<string, number>;
  // The user's sheet has a second preset-like column right after "Preset"
  // (headed "Shop Email" but holding preset names). Keep it as a fallback.
  const altIdx = idx.preset >= 0 ? idx.preset + 1 : -1;

  const sales: ParsedSale[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerRow + 1)) {
    const get = (i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
    if (r.every((c) => !String(c ?? "").trim())) continue; // blank line
    const soldAt = parseSaleDate(get(idx.date));
    const shopDomain = normalizeDomain(get(idx.shopDomain));
    if (!soldAt || !shopDomain) {
      skipped++;
      continue;
    }
    const alt = get(altIdx);
    sales.push({
      soldAt,
      month: soldAt.toISOString().slice(0, 7),
      shopName: get(idx.shopName),
      shopDomain,
      country: get(idx.country).toUpperCase(),
      chargeType: normalizeChargeType(get(idx.chargeType)),
      amount: parseMoney(get(idx.amount)),
      fee: parseMoney(get(idx.fee)),
      share: parseMoney(get(idx.share)),
      sheetPreset: get(idx.preset),
      sheetPresetAlt: alt.includes("@") ? "" : alt,
    });
  }
  return { sales, skipped, headerRow };
}

/**
 * One theme's sales from a file. For a workbook with several tabs, the tab
 * named after `themeName` is used, else the first tab that looks like a
 * sales table.
 */
export async function parseSalesFile(buffer: Buffer, fileName: string, themeName?: string): Promise<ParseResult> {
  if (!isXlsx(buffer, fileName)) return salesFromRows(parseDelimited(buffer.toString("utf8").replace(/^﻿/, "")));
  const sheets = await readWorkbook(buffer);
  const named = themeName ? matchThemeForTab(themeName, sheets.map((s) => ({ ...s, name: s.name }))) : null;
  for (const sheet of named ? [named, ...sheets] : sheets) {
    try {
      return salesFromRows(sheet.rows);
    } catch (err) {
      if (!(err instanceof SalesFileError)) throw err;
    }
  }
  return salesFromRows(sheets[0].rows); // throws the "no header" error
}
