import { resolvePeriod } from "@/lib/service/ui/period";
import { PeriodBar } from "../_dashboard/period-bar";
import { TeamsTab } from "../_dashboard/teams-tab";

export const dynamic = "force-dynamic";

// The service team (Chat senders of TIMER STATUS): who logged how much, for any period. Same report as the dashboard's Teams tab.
export default async function ServiceTeamPage({ searchParams }: { searchParams: Promise<{ g?: string; d?: string; from?: string; to?: string; view?: string }> }) {
  const sp = await searchParams;
  const period = resolvePeriod(sp);
  const flat = sp.view === "all";
  return (
    <div className="space-y-5">
      <PeriodBar base="/service/team" tab={null} period={period} extra={flat ? "&view=all" : ""} />
      <TeamsTab period={period} flat={flat} base="/service/team" tab={null} />
    </div>
  );
}
