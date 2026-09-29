import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db/connect";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { presetNamesFor } from "@/lib/sales/presetNames";
import { SaleRecord } from "@/models/sale-record";
import { SalesStore } from "@/models/sales-store";
import { Theme } from "@/models/theme";

type StoreDoc = {
  _id: unknown;
  themeId: unknown;
  shopDomain: string;
  status: string;
  liveUrl: string | null;
  liveThemeName: string | null;
  liveSchemaName: string | null;
  detectedPreset: string | null;
  detectedSource: string;
  manualPreset: string | null;
  checkedAt: Date | null;
  error: string | null;
};

// GET /api/sales/stores?themeId= — every buyer store with what it runs now
// and which preset its sales count under.
export async function GET(request: Request) {
  const themeId = new URL(request.url).searchParams.get("themeId") || null;
  if (themeId && !isValidObjectId(themeId)) return invalidIdResponse("themeId");
  await connectToDatabase();
  const [stores, counts, themes] = await Promise.all([
    SalesStore.find(themeId ? { themeId } : {}).sort({ shopDomain: 1 }).lean<StoreDoc[]>(),
    SaleRecord.aggregate<{ _id: { t: unknown; d: string }; sales: number; name: string; last: Date }>([
      { $match: themeId ? { themeId: new Types.ObjectId(themeId) } : {} },
      { $sort: { soldAt: -1 } },
      {
        $group: {
          _id: { t: "$themeId", d: "$shopDomain" },
          sales: { $sum: { $cond: [{ $eq: ["$chargeType", "refund"] }, -1, 1] } },
          name: { $first: "$shopName" },
          last: { $first: "$soldAt" },
        },
      },
    ]),
    Theme.find({}).select("name themeStorePresets").lean<{ _id: unknown; name: string; themeStorePresets?: { name: string }[] }[]>(),
  ]);
  const countFor = new Map(counts.map((c) => [`${c._id.t}|${c._id.d}`, c]));
  const themeById = new Map(themes.map((t) => [String(t._id), t]));
  return NextResponse.json({
    stores: stores.map((s) => {
      const c = countFor.get(`${s.themeId}|${s.shopDomain}`);
      const t = themeById.get(String(s.themeId));
      return {
        id: String(s._id),
        themeId: String(s.themeId),
        themeName: t?.name ?? "",
        presetOptions: t ? presetNamesFor(t) : [],
        shopDomain: s.shopDomain,
        shopName: c?.name ?? "",
        netSales: c?.sales ?? 0,
        lastSaleAt: c?.last ?? null,
        status: s.status,
        liveUrl: s.liveUrl,
        liveThemeName: s.liveThemeName,
        liveSchemaName: s.liveSchemaName,
        detectedPreset: s.detectedPreset,
        detectedSource: s.detectedSource,
        manualPreset: s.manualPreset,
        preset: s.manualPreset ?? s.detectedPreset ?? null,
        checkedAt: s.checkedAt,
        error: s.error,
      };
    }),
  });
}

// PATCH /api/sales/stores { id, manualPreset } — set (or clear, with null) a store's preset by hand.
export async function PATCH(request: Request) {
  const body = (await request.json().catch(() => null)) as { id?: unknown; manualPreset?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!isValidObjectId(id)) return invalidIdResponse("id");
  const manualPreset = body?.manualPreset === null || body?.manualPreset === "" ? null : body?.manualPreset;
  if (manualPreset !== null && (typeof manualPreset !== "string" || manualPreset.length > 100)) {
    return NextResponse.json({ error: "manualPreset must be a preset name or null." }, { status: 400 });
  }
  await connectToDatabase();
  const store = await SalesStore.findByIdAndUpdate(id, { $set: { manualPreset } }, { new: true }).lean();
  if (!store) return NextResponse.json({ error: "Store not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
