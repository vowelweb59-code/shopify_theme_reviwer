import { Suspense } from "react";
import { TabbedPageClient } from "@/app/_components/TabbedPage";
import { SettingsContent } from "./SettingsContent";
import { MaintenanceContent } from "@/app/maintenance/MaintenanceContent";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <TabbedPageClient
        title="Settings"
        defaultTabId="general"
        tabs={[
          { id: "general", label: "General", content: <SettingsContent /> },
          { id: "maintenance", label: "Maintenance", content: <MaintenanceContent /> },
        ]}
      />
    </Suspense>
  );
}
