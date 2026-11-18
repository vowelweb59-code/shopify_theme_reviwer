import { Suspense } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { SettingsContent } from "./SettingsContent";
import { Ga4ConnectionsContent } from "./Ga4ConnectionsContent";
import { MaintenanceContent } from "@/app/maintenance/MaintenanceContent";
import { ServiceChatPanel } from "./ServiceChatPanel";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ connected?: string; error?: string }> }) {
  const { connected, error } = await searchParams;
  return (
    <PageContainer>
      <Suspense fallback={null}>
        <TabbedPageClient
          title="Settings"
          defaultTabId="general"
          tabs={[
            { id: "general", label: "General", content: <SettingsContent /> },
            { id: "analytics", label: "GA4 Analytics", content: <Ga4ConnectionsContent /> },
            { id: "service-chat", label: "Service Chat", content: <ServiceChatPanel connected={connected} error={error} /> },
            { id: "maintenance", label: "Maintenance", content: <MaintenanceContent /> },
          ]}
        />
      </Suspense>
    </PageContainer>
  );
}
