import Link from "next/link";

const SECTIONS = [
  {
    href: "/audit",
    title: "Audit",
    description: "Upload a theme zip and run a deterministic Theme Store compliance audit.",
  },
  {
    href: "/rules",
    title: "Rules",
    description: "Browse Shopify requirements and the rules that check them.",
  },
  {
    href: "/reports",
    title: "Reports",
    description: "View past audit runs and their findings.",
  },
  {
    href: "/settings",
    title: "Settings",
    description: "Application and rule configuration.",
  },
] as const;

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
        Shopify Theme Auditor
      </h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-lg border border-black/[.08] p-5 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:hover:bg-white/[.04]"
          >
            <h2 className="font-medium text-zinc-950 dark:text-zinc-50">{section.title}</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{section.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
