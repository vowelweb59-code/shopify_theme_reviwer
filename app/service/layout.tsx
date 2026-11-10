import type { ReactNode } from "react";
import { PageContainer } from "@/app/_components/shell/PageContainer";
import { ServiceNav } from "./_components/ServiceNav";

// Service Team: the Upwork client-work operation (hours from the TIMER STATUS Chat space, clients, contracts, review),
// ported from the Upwork Project-Management app. Its data lives in service_* collections, apart from the theme team's.
export const dynamic = "force-dynamic";

export default function ServiceLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer className="max-w-7xl gap-6">
      <div>
        <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-50">Service Team</h1>
        <p className="mt-1 text-sm text-zinc-500">Hours are reported and tracked in the TIMER STATUS Chat space, not Upwork-verified billable hours.</p>
      </div>
      <ServiceNav />
      {children}
    </PageContainer>
  );
}
