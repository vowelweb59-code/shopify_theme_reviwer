import { Suspense } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { SettingsContent } from "./SettingsContent";
import { Ga4ConnectionsContent } from "./Ga4ConnectionsContent";
import { MaintenanceContent } from "@/app/maintenance/MaintenanceContent";

export default function SettingsPage() {
  return (
    <PageContainer>
      <Suspense fallback={null}>
        <TabbedPageClient
          title="Settings"
          defaultTabId="general"
          tabs={[
            { id: "general", label: "General", content: <SettingsContent /> },
            { id: "analytics", label: "GA4 Analytics", content: <Ga4ConnectionsContent /> },
            { id: "maintenance", label: "Maintenance", content: <MaintenanceContent /> },
          ]}
        />
      </Suspense>
    </PageContainer>
  );
}
