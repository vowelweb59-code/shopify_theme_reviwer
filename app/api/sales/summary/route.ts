import { NextResponse } from "next/server";
import { connectToDatabase } from "@/lib/db/connect";
import { invalidIdResponse, isValidObjectId } from "@/lib/api/validation";
import { getSalesSummary } from "@/lib/sales/summary";
import { SaleRecord } from "@/models/sale-record";
import { SalesStore } from "@/models/sales-store";

// GET /api/sales/summary?themeId=&from=YYYY-MM&to=YYYY-MM — every Sales table in one response.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const themeId = searchParams.get("themeId") || null;
  if (themeId && !isValidObjectId(themeId)) return invalidIdResponse("themeId");
  const summary = await getSalesSummary({ themeId, from: searchParams.get("from"), to: searchParams.get("to") });
  return NextResponse.json(summary);
}

// DELETE /api/sales/summary?themeId= — removes one theme's imported sales and stores (to re-import from scratch).
export async function DELETE(request: Request) {
  const themeId = new URL(request.url).searchParams.get("themeId");
  if (!isValidObjectId(themeId)) return invalidIdResponse("themeId");
  await connectToDatabase();
  const [sales, stores] = await Promise.all([SaleRecord.deleteMany({ themeId }), SalesStore.deleteMany({ themeId })]);
  return NextResponse.json({ deletedSales: sales.deletedCount, deletedStores: stores.deletedCount });
}
