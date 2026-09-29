import type { Metadata } from "next";
import { connection } from "next/server";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "./_components/shell/AppShell";
import { authMode } from "@/lib/auth/session";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Render per request: the login settings (and so the Sign out button)
  // come from the runtime env, which isn't there at build time in Docker.
  await connection();
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full bg-background text-foreground">
        <AppShell authEnabled={authMode(process.env) === "check"}>{children}</AppShell>
      </body>
    </html>
  );
}
