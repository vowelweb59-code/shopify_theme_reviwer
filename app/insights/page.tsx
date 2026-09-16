import { Suspense } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { RulesContent } from "@/app/rules/RulesContent";
import { PageSpeedContent } from "@/app/page-speed/PageSpeedContent";
import { FutureUpdatesContent } from "@/app/enhancements/FutureUpdatesContent";

export default function InsightsPage() {
  return (
    <Suspense fallback={null}>
      <TabbedPageClient
        title="Insights"
        description="Rule coverage, live page-speed results, and the future-updates backlog for every theme."
        defaultTabId="rules"
        tabs={[
          { id: "rules", label: "Rules", content: <RulesContent /> },
          { id: "page-speed", label: "Page Speed", content: <PageSpeedContent /> },
          { id: "future-updates", label: "Future updates", content: <FutureUpdatesContent /> },
        ]}
      />
    </Suspense>
  );
}
