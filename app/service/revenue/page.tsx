import { connectToDatabase } from "@/lib/db/connect";
import { loadRevenueInput } from "@/lib/service/revenue/load";
import { RevenueView } from "./_components/RevenueView";

export const dynamic = "force-dynamic";

// Revenue tab (owner, 2026-11-17): money actually taken from clients against what the reported hours were worth. The view lives in
// _components/RevenueView.tsx so it can be rendered with test data; this page only loads the data.
export default async function ServiceRevenuePage({ searchParams }: { searchParams: Promise<{ range?: string; status?: string }> }) {
  const sp = await searchParams;
  await connectToDatabase();
  return <RevenueView input={await loadRevenueInput()} rangeId={sp.range} statusId={sp.status} />;
}
