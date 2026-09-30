import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { SalesFileError, matchThemeForTab, parseDelimited, salesFromRows } from "@/lib/sales/parseSalesFile";
import { importSales } from "@/lib/sales/importSales";
import { startDetection } from "@/lib/sales/detectionJob";
import { Theme } from "@/models/theme";
import type { TabResult } from "../route";

const MAX_TEXT_CHARS = 5 * 1024 * 1024;

// POST /api/sales/import/paste — JSON { themeName, text }.
// `text` is rows copied straight out of the sales sheet (tab-separated when
// copied from Google Sheets or Excel; CSV also works), with or without the
// header row. `themeName` is matched to a Themes-module theme the same way
// a workbook tab name is. Rows already imported are skipped, so pasting the
// whole tab again only adds the new sales.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { themeName?: unknown; text?: unknown } | null;
  const themeName = typeof body?.themeName === "string" ? body.themeName.trim() : "";
  const text = typeof body?.text === "string" ? body.text.replace(/^﻿/, "") : "";
  if (!themeName) return NextResponse.json({ error: "Enter the main theme name." }, { status: 400 });
  if (!text.trim()) return NextResponse.json({ error: "Paste the sales rows." }, { status: 400 });
  if (text.length > MAX_TEXT_CHARS) return NextResponse.json({ error: "That's more than 5 MB of text. Upload the workbook as .xlsx instead." }, { status: 400 });

  await connectToDatabase();
  const themes = await Theme.find({}).select("name").lean<{ _id: unknown; name: string }[]>();
  const theme = matchThemeForTab(themeName, themes);
  if (!theme) {
    return NextResponse.json(
      { error: `No theme called “${themeName}”. Use one of: ${themes.map((t) => t.name).join(", ")}.` },
      { status: 400 }
    );
  }

  try {
    const parsed = salesFromRows(parseDelimited(text), { headerOptional: true });
    if (parsed.sales.length === 0) {
      return NextResponse.json(
        { error: "No sales found in the pasted text. Each row needs a sale date and a shop domain (e.g. store.myshopify.com)." },
        { status: 400 }
      );
    }
    const result = await importSales(String(theme._id), parsed.sales);
    startDetection();
    const tab: TabResult = { tab: "Pasted rows", themeName: theme.name, ...result, rowsRead: parsed.sales.length, skipped: parsed.skipped };
    return NextResponse.json({ tabs: [tab] });
  } catch (err) {
    if (err instanceof SalesFileError) return NextResponse.json({ error: err.message }, { status: 400 });
    console.error("[sales] paste import failed:", err);
    return NextResponse.json({ error: "Couldn't import the pasted rows." }, { status: 500 });
  }
}
