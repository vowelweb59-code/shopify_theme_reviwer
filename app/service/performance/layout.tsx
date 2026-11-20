import type { ReactNode } from "react";
import { PerfTabs } from "./_components/PerfTabs";

export const dynamic = "force-dynamic";

export default function PerformanceLayout({ children }: { children: ReactNode }) {
  return (
    <div className="space-y-5">
      <PerfTabs />
      {children}
    </div>
  );
}
