import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Shopify Theme Auditor",
  description: "Internal tool for auditing Shopify themes against Theme Store requirements.",
};

const NAV_LINKS = [
  { href: "/audit", label: "Audit" },
  { href: "/rules", label: "Rules" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
] as const;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 dark:bg-black">
        <header className="border-b border-black/[.08] dark:border-white/[.145]">
          <nav className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-4">
            <Link href="/" className="font-semibold text-zinc-950 dark:text-zinc-50">
              Shopify Theme Auditor
            </Link>
            <div className="flex gap-4 text-sm text-zinc-600 dark:text-zinc-400">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="hover:text-zinc-950 dark:hover:text-zinc-50"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="flex flex-1 flex-col">{children}</main>
      </body>
    </html>
  );
}
