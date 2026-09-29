import ExcelJS from "exceljs";

// Reads a Shopify Partner theme-sales export (the user's sheet, downloaded
// as .xlsx or .csv, or copied as tab-separated text), roughly:
//   Date | Shop Name | Shop Domain | Preset… | Country | Charge Type | Sale | Fee | Share
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
  /** The sheet's own preset columns, best first (see presetColumns). */
  sheetPresets: string[];
};

export type ParseResult = { sales: ParsedSale[]; skipped: number; headerRow: number };

export class SalesFileError extends Error {}

const HEADER_ALIASES: Record<string, string[]> = {
  date: ["date", "sale date", "created at", "charge date"],
  shopName: ["shop name", "store name", "shop"],
  shopDomain: ["shop domain", "store domain", "domain", "store url", "shop url", "myshopify domain"],
  country: ["country", "shop country"],
  chargeType: ["charge type", "type"],
  amount: ["sale", "partner sale", "amount", "price", "gross"],
  fee: ["fee", "fees", "shopify fee"],
  share: ["share", "partner share", "net", "payout", "your share"],
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

/**
 * A cell's visible text. Not exceljs's `cell.text`, which throws on a merged
 * cell whose main cell is empty — found on the user's real Google Sheets
 * export, 2026-09-29. Merged cells read their main cell's value.
 */
function cellText(cell: ExcelJS.Cell): string {
  const raw = cell.isMerged && cell.master !== cell ? cell.master.value : cell.value;
  return valueText(raw);
}

function valueText(v: ExcelJS.CellValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v !== "object") return String(v);
  if ("richText" in v && Array.isArray(v.richText)) return v.richText.map((p) => p.text ?? "").join("");
  if ("text" in v && v.text !== undefined) return valueText(v.text as ExcelJS.CellValue);
  if ("result" in v) return valueText(v.result as ExcelJS.CellValue);
  if ("error" in v) return "";
  return "";
}

/** Every tab of an .xlsx, in order, as rows of cell text. */
export async function readWorkbook(buffer: Buffer): Promise<WorkbookSheet[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  if (workbook.worksheets.length === 0) throw new SalesFileError("The workbook has no sheets.");
  return workbook.worksheets.map((sheet) => {
    const rows: string[][] = [];
    sheet.eachRow({ includeEmpty: false }, (r) => {
      const cells: string[] = [];
      for (let c = 1; c <= r.cellCount; c++) cells.push(cellText(r.getCell(c)));
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

const CHARGE_RE = /^(theme\s+)?(sale|refund)$|^theme\s+\w+$|refund/i;
const NUMBER_RE = /^-?\$?\d[\d,]*(\.\d+)?$/;
const COUNTRY_RE = /^[A-Z]{2}$/;

function looksLikeDomain(s: string): boolean {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/\S*)?$/i.test(s.trim()) && !s.includes("@");
}

/** Columns that hold a preset: headed "Preset…"/"…Tool…", "Manual" ones first (the user's own call beats a tool's). */
function presetColumns(headers: string[]): number[] {
  const labelled = headers.map((h, i) => ({ h, i })).filter(({ h }) => /preset|tool/.test(h));
  const ordered = [...labelled.filter(({ h }) => /manual/.test(h)), ...labelled.filter(({ h }) => !/manual/.test(h))].map(({ i }) => i);
  // The user's sheets often keep a second preset right after the labelled
  // one, under a blank or unrelated header ("Shop Email" on the Adorn tab);
  // per-row filtering below drops it when it holds an email or anything else.
  const last = labelled.length ? Math.max(...labelled.map(({ i }) => i)) : -1;
  if (last >= 0 && !ordered.includes(last + 1)) ordered.push(last + 1);
  return ordered;
}

function isPresetValue(v: string): boolean {
  const s = v.trim();
  return !!s && !s.includes("@") && !looksLikeDomain(s) && !NUMBER_RE.test(s) && !COUNTRY_RE.test(s) && !CHARGE_RE.test(s) && s.length <= 60;
}

/**
 * Reads the sales rows under the header. Each tab of the user's workbook
 * labels and orders columns a little differently, and on some tabs the
 * header is one column off from the data (Gravity, Nexus — seen in the real
 * workbook 2026-09-29), so money and charge type are found by content: the
 * "Theme sale"/"Theme refund" cell, then the next three numbers (Sale, Fee,
 * Share). Headers are only hints.
 */
export function salesFromRows(rows: string[][]): ParseResult {
  const headerRow = rows.findIndex((r) => {
    const cells = r.map(norm);
    return HEADER_ALIASES.date.some((a) => cells.includes(a)) && HEADER_ALIASES.shopDomain.some((a) => cells.includes(a));
  });
  if (headerRow === -1) throw new SalesFileError('Couldn\'t find the header row — the sheet needs at least a "Date" and a "Shop Domain" column.');

  const headers = rows[headerRow].map(norm);
  const col = (field: string) => headers.findIndex((h) => HEADER_ALIASES[field].includes(h));
  const idx = Object.fromEntries(Object.keys(HEADER_ALIASES).map((f) => [f, col(f)])) as Record<string, number>;
  const presetIdx = presetColumns(headers);

  const sales: ParsedSale[] = [];
  let skipped = 0;
  for (const r of rows.slice(headerRow + 1)) {
    const cells = r.map((c) => String(c ?? "").trim());
    const get = (i: number) => (i >= 0 ? cells[i] ?? "" : "");
    if (cells.every((c) => !c)) continue; // blank line

    const soldAt = parseSaleDate(get(idx.date)) ?? parseSaleDate(cells.find((c) => /^\d{4}-\d{2}-\d{2}/.test(c)) ?? "");
    let domainIdx = looksLikeDomain(get(idx.shopDomain)) ? idx.shopDomain : cells.findIndex((c) => /\.myshopify\.com/i.test(c));
    if (domainIdx < 0) domainIdx = idx.shopDomain;
    const shopDomain = normalizeDomain(get(domainIdx));
    if (!soldAt || !shopDomain) {
      skipped++;
      continue;
    }

    const chargeIdx = cells.findIndex((c, i) => i > domainIdx && CHARGE_RE.test(c));
    let moneyIdx = -1;
    for (let i = Math.max(chargeIdx, domainIdx) + 1; i + 2 < cells.length; i++) {
      if (NUMBER_RE.test(cells[i]) && NUMBER_RE.test(cells[i + 1]) && NUMBER_RE.test(cells[i + 2])) {
        moneyIdx = i;
        break;
      }
    }
    const amount = parseMoney(moneyIdx >= 0 ? cells[moneyIdx] : get(idx.amount));
    const fee = parseMoney(moneyIdx >= 0 ? cells[moneyIdx + 1] : get(idx.fee));
    const share = parseMoney(moneyIdx >= 0 ? cells[moneyIdx + 2] : get(idx.share));
    const chargeType = chargeIdx >= 0 ? normalizeChargeType(cells[chargeIdx]) : amount < 0 ? "refund" : "sale";

    const headerCountry = get(idx.country).toUpperCase();
    const stop = moneyIdx >= 0 ? moneyIdx : cells.length;
    const found = cells.slice(domainIdx + 1, stop).filter((c) => COUNTRY_RE.test(c));
    const country = COUNTRY_RE.test(headerCountry) ? headerCountry : (found[found.length - 1] ?? "");

    const presets = [...new Set(presetIdx.map(get).filter(isPresetValue))];
    sales.push({
      soldAt,
      month: soldAt.toISOString().slice(0, 7),
      shopName: get(idx.shopName),
      shopDomain,
      country,
      chargeType,
      amount,
      fee,
      share,
      sheetPresets: presets,
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
