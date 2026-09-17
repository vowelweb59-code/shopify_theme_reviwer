import type { ReactNode } from "react";

/**
 * Replaces the old centered-marketing-page container
 * (`mx-auto max-w-5xl px-6 py-16`) now that a persistent sidebar takes up
 * its own space — tighter vertical padding, slightly wider max content
 * width to suit a workspace rather than a landing page.
 */
export function PageContainer({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-10 ${className}`}>{children}</div>;
}
