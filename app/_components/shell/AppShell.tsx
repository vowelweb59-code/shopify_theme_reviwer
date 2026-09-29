"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";

/** Sidebar (desktop) + top bar/drawer (mobile) + content area — replaces the old horizontal top nav app-wide. The login page renders bare. */
export function AppShell({ children, authEnabled }: { children: ReactNode; authEnabled: boolean }) {
  const pathname = usePathname();
  if (pathname === "/login") return <>{children}</>;

  return (
    <div className="flex min-h-full">
      <Sidebar authEnabled={authEnabled} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileNav authEnabled={authEnabled} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
