import Link from "next/link";
import { GRANULARITIES, stepAnchor, todayIST, type Period } from "@/lib/service/ui/period";

export type TabId = "projects" | "teams" | "departments";

/**
 * Link to a period view on `base` (the dashboard, /service, carries ?tab=; the Team page, /service/team, does not).
 * Custom ranges carry their own from/to; the others carry an anchor day.
 */
export function periodHref(base: string, tab: TabId | null, p: { g: string; anchor?: string; from?: string; to?: string }, extra = ""): string {
  const q = new URLSearchParams(tab ? { tab, g: p.g } : { g: p.g });
  if (p.g === "custom" && p.from && p.to) {
    q.set("from", p.from);
    q.set("to", p.to);
  } else if (["day", "week", "month"].includes(p.g) && p.anchor) q.set("d", p.anchor);
  return `${base}?${q}${extra}`;
}

export const dashHref = (tab: TabId, p: { g: string; anchor?: string; from?: string; to?: string }, extra = "") => periodHref("/service", tab, p, extra);

const pill = (on: boolean) => `rounded-md border px-2.5 py-1 text-sm ${on ? "border-primary bg-primary font-medium text-primary-foreground" : "border-border-subtle hover:bg-surface-muted"}`;
const step = "rounded-md border border-border-subtle px-2 py-1 hover:bg-surface-muted";

/** Day / Week / Month / Last 7 / Last 30 / Custom, with arrows to step. All links and a form: no JavaScript needed. */
export function PeriodBar({ base = "/service", tab, period, extra = "" }: { base?: string; tab: TabId | null; period: Period; extra?: string }) {
  const prev = stepAnchor(period, -1);
  const next = stepAnchor(period, 1);
  const href = (p: { g: string; anchor?: string; from?: string; to?: string }) => periodHref(base, tab, p, extra);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <nav aria-label="Period" className="flex flex-wrap gap-1.5">
          {GRANULARITIES.map((x) => (
            <Link key={x.g} href={href({ g: x.g, ...(x.g === "custom" ? { from: period.from, to: period.to } : { anchor: period.anchor }) })} aria-current={period.g === x.g ? "true" : undefined} className={pill(period.g === x.g)}>
              {x.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 text-sm">
          {prev && <Link href={href({ g: period.g, anchor: prev })} aria-label="Previous period" className={step}>←</Link>}
          <span className="px-1 font-medium">{period.label}</span>
          {next && <Link href={href({ g: period.g, anchor: next })} aria-label="Next period" className={step}>→</Link>}
          {["day", "week", "month"].includes(period.g) && <Link href={href({ g: period.g, anchor: todayIST() })} className={step}>Today</Link>}
        </div>
      </div>
      {period.g === "custom" && (
        <form action={base} method="get" className="flex flex-wrap items-end gap-2 text-sm">
          {tab && <input type="hidden" name="tab" value={tab} />}
          <input type="hidden" name="g" value="custom" />
          <label>
            <span className="mb-1 block text-zinc-500">From</span>
            <input type="date" name="from" defaultValue={period.from} required className="rounded-md border border-border-subtle bg-transparent px-2 py-1" />
          </label>
          <label>
            <span className="mb-1 block text-zinc-500">To</span>
            <input type="date" name="to" defaultValue={period.to} required className="rounded-md border border-border-subtle bg-transparent px-2 py-1" />
          </label>
          <button className="rounded-md border border-border-subtle px-3 py-1.5 hover:bg-surface-muted">Apply</button>
        </form>
      )}
    </div>
  );
}
