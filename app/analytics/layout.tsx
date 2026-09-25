import { Suspense, type ReactNode } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { AnalyticsShell } from "./_components/AnalyticsShell";

// Every /analytics page shares the header, global controls, filter bar and
// section links. They read the URL (useSearchParams), which needs a
// Suspense boundary for the pages to prerender.
export default function AnalyticsLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer>
      <Suspense fallback={null}>
        <AnalyticsShell>{children}</AnalyticsShell>
      </Suspense>
    </PageContainer>
  );
}
