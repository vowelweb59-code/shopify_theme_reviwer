import { Suspense } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { CodeReviewContent } from "./_components/CodeReviewContent";
import { StoreReviewContent } from "./_components/StoreReviewContent";
import { PageSpeedContent } from "@/app/page-speed/PageSpeedContent";
import { FutureUpdatesContent } from "@/app/enhancements/FutureUpdatesContent";

export default function InsightsPage() {
  return (
    <PageContainer>
      <Suspense fallback={null}>
        <TabbedPageClient
          title="Audit Rules"
          description="Rule coverage split by how it's checked, live page-speed results, and the future-updates backlog for every theme."
          defaultTabId="code-review"
          orientation="vertical"
          tabs={[
            { id: "code-review", label: "Code Review", content: <CodeReviewContent /> },
            { id: "store-review", label: "Store Review", content: <StoreReviewContent /> },
            { id: "page-speed", label: "Page Speed", content: <PageSpeedContent /> },
            { id: "future-updates", label: "Future updates", content: <FutureUpdatesContent /> },
          ]}
        />
      </Suspense>
    </PageContainer>
  );
}
