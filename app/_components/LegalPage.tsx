import type { ReactNode } from "react";
import Link from "next/link";
import { LEGAL_APP_NAME, LEGAL_UPDATED } from "@/lib/legal/pages";

/** The frame of the public privacy and terms pages: no sidebar, no sign-in, plain readable text. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-muted px-4 py-12">
      <main className="mx-auto w-full max-w-2xl rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm sm:p-10">
        <p className="text-sm font-medium text-primary">{LEGAL_APP_NAME}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">{title}</h1>
        <p className="mt-1 text-sm text-zinc-500">Last updated {LEGAL_UPDATED}</p>
        <div className="mt-6 space-y-5 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 [&_h2]:mb-1.5 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-zinc-950 dark:[&_h2]:text-zinc-50 [&_ul]:ml-5 [&_ul]:list-disc [&_ul]:space-y-1">
          {children}
        </div>
        <nav className="mt-8 flex gap-4 border-t border-border-subtle pt-4 text-sm">
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy policy
          </Link>
          <Link href="/terms" className="text-primary hover:underline">
            Terms of service
          </Link>
        </nav>
      </main>
    </div>
  );
}
