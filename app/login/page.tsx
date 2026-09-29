import type { Metadata } from "next";
import { ScanSearch } from "lucide-react";
import { safeNextPath } from "@/lib/auth/nextPath";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in · Shopify Theme Auditor",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(typeof next === "string" ? next : null);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-surface-muted px-4 py-12">
      {/* Soft brand-colored glow behind the card; purely decorative. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />

      <main className="relative w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <ScanSearch className="h-6 w-6" aria-hidden />
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">Sign in to Shopify Theme Auditor</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Audits, rankings and analytics for your team&apos;s themes.</p>
        </div>

        <div className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm sm:p-8">
          <LoginForm nextPath={nextPath} />
        </div>

        <p className="mt-6 text-center text-xs text-zinc-500">Internal tool. Ask your admin if you need access.</p>
      </main>
    </div>
  );
}
