import { NextResponse } from "next/server";
import { partnerDetailsProgress, startPartnerDetails } from "@/lib/partners/crawlPartners";

// GET /api/partners/details — progress of reading partners' contact details.
export async function GET() {
  return NextResponse.json(partnerDetailsProgress());
}

// POST /api/partners/details — start reading the partners not read yet (no-op while a crawl runs).
export async function POST() {
  startPartnerDetails();
  return NextResponse.json(partnerDetailsProgress(), { status: 202 });
}
