import { loadSpaceReview } from "@/lib/service/chat/space-scan";
import { SpaceScan } from "./_components/SpaceScan";

export const dynamic = "force-dynamic";

export default async function SpaceScanPage() {
  return <SpaceScan review={await loadSpaceReview()} />;
}
