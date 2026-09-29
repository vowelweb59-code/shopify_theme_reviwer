"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";

/** Ends the session and goes to /login. A full page load (not router.push) so no signed-in page stays cached in the client. */
export function SignOutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    try {
      await fetch("/api/session", { method: "DELETE" });
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full load on purpose, see above
      window.location.assign("/login");
    }
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={pending}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-zinc-900 disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-white/[.04] dark:hover:text-zinc-100 ${className}`}
    >
      <LogOut className="h-4 w-4 shrink-0" aria-hidden />
      {pending ? "Signing out…" : "Sign out"}
    </button>
  );
}
