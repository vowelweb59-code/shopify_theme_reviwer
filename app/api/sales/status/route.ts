import { NextResponse } from "next/server";
import { detectionProgress } from "@/lib/sales/detectionJob";
import { categoryCrawlProgress } from "@/lib/sales/categories";

// GET /api/sales/status — progress of the background store check and category crawl.
export function GET() {
  return NextResponse.json({ detection: detectionProgress(), categories: categoryCrawlProgress() });
}
