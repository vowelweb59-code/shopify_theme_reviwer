"use client";

import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { NAV_ITEMS } from "./navItems";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Top bar + slide-in drawer, shown only below md. Radix Dialog supplies the focus trap and Escape-to-close for the drawer. */
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex items-center justify-between border-b border-border-subtle bg-surface px-4 py-3 md:hidden">
      <span className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Shopify Theme Auditor</span>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>
          <button type="button" aria-label="Open navigation menu" className="rounded-md p-1.5 text-zinc-600 hover:bg-black/[.04] dark:text-zinc-400 dark:hover:bg-white/[.06]">
            <Menu className="h-5 w-5" aria-hidden />
          </button>
        </Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed inset-y-0 left-0 z-50 flex w-64 max-w-[80vw] flex-col bg-surface-sidebar shadow-lg focus:outline-none">
            <div className="flex items-center justify-between px-4 py-4">
              <Dialog.Title className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">Menu</Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close navigation menu" className="rounded-md p-1 text-zinc-400 hover:bg-black/[.04] dark:hover:bg-white/[.06]">
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </Dialog.Close>
            </div>
            <nav aria-label="Main" className="flex flex-col gap-0.5 px-2">
              {NAV_ITEMS.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? "bg-black/[.06] font-medium text-zinc-950 dark:bg-white/[.08] dark:text-zinc-50"
                        : "text-zinc-600 hover:bg-black/[.04] hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/[.04] dark:hover:text-zinc-100"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
