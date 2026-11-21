import Link from "next/link";
import { uniqueBa } from "@/lib/service/ba-members";
import { uniqueBd } from "@/lib/service/bd-members";
import { dmMatch } from "@/lib/service/dm-members";
import { workableMinutes } from "@/lib/service/hours/fixed-budget";
import { load } from "@/lib/service/api/http";
import { istDate } from "@/lib/service/import/text";
import { projectWeek, teamHours } from "@/lib/service/api/hours";
import { assignableUsers, getAssignments, getDetails, getProject } from "@/lib/service/api/projects";
import { fmtMinutes, fmtUsd, ServiceStatusBadge, shiftWeek, weekLabel } from "@/lib/service/ui/format";
import { Avatar, Card, DayBars, Metric, PeopleLine, Row } from "./_components/OverviewParts";
import { TeamHoursTable } from "./_components/TeamHoursTable";
import { AssignmentsEditor } from "./_components/AssignmentsEditor";
import { ContractEditor } from "./_components/ContractEditor";
import { InHouseEditor, KeywordsEditor, PeopleEditor, ProfileEditor, ReviewEditor } from "./_components/DetailsEditors";
import { StatusControl } from "./_components/StatusControl";

export const dynamic = "force-dynamic";

const SECTION = "rounded-lg border border-border-subtle bg-surface p-4";

export default async function ServiceProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string; on?: string; by?: string; view?: string; hours?: string }> }) {
  const { id } = await params;
  const { week, on: onRaw, by: byRaw, view, hours: scope } = await searchParams;
  const byMonth = byRaw === "month";
  const teamOnly = scope === "team";
  const settings = view === "settings";
  // The period to look at (owner, 2026-11-20): a week or a calendar month; `on` is any day inside it (`week` is the older name of the same parameter).
  const pick = onRaw ?? week;
  const wk = pick && /^\d{4}-\d{2}-\d{2}$/.test(pick) ? pick : pick && /^\d{4}-\d{2}$/.test(pick) ? `${pick}-01` : null;
  const [project, assignments, pw, details, team_, users] = await load(() =>
    Promise.all([getProject(id), getAssignments(id), projectWeek(id, wk, teamOnly, byMonth ? "month" : "week"), getDetails(id), teamHours(id, wk, teamOnly, byMonth ? "month" : "week"), assignableUsers()])
  );
  const managers = assignments.filter((a) => a.assignmentRole === "MANAGER");
  const team = assignments.filter((a) => a.assignmentRole === "EMPLOYEE");
  const base = `/service/projects/${project.id}`;
  const q = (on?: string, h = teamOnly, m = byMonth) => { const p = new URLSearchParams(); if (on) p.set("on", on); if (m) p.set("by", "month"); if (h) p.set("hours", "team"); return p.size ? `?${p}` : ""; };
  const unit = byMonth ? "month" : "week";
  const monthStart = (anchor: string, by: number) => { const [y, m] = anchor.split("-").map(Number); return new Date(Date.UTC(y, m - 1 + by, 1)).toISOString().slice(0, 10); };
  const prevOn = byMonth ? monthStart(pw.week.start, -1) : shiftWeek(pw.week.start, -1);
  const nextOn = byMonth ? monthStart(pw.week.start, 1) : shiftWeek(pw.week.start, 1);
  const periodText = byMonth ? new Date(`${pw.week.start}T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }) : weekLabel(pw.week);
  const todayIso = istDate(new Date());
  const isCurrent = todayIso >= pw.week.start && todayIso <= pw.week.end;
  const navBtn = "rounded-md border border-border-subtle px-2 py-1 hover:bg-surface-muted";
  const c = pw.contract;
  const used = team_.rows.reduce((n, r) => n + r.total, 0);
  const billedByHours = c?.type === "FIXED" && c.hourlyRateCents != null;
  const budgetTotal = c?.type === "FIXED" && c.hourlyRateCents == null ? workableMinutes(c.fixedPriceCents) : null;
  // Fixed work with no hourly rate is valued at the standard $15/h, as on the Revenue tab.
  const rateCents = c?.hourlyRateCents ?? (c?.type === "FIXED" && budgetTotal !== null ? 1500 : null);
  const revenueSoFar = rateCents !== null ? Math.round((used / 60) * rateCents) : null;
  const amountPeriod = pw.hours && rateCents !== null && !details.inHouse ? Math.round((pw.hours.completedMinutes * rateCents) / 60) : null;
  const limit = pw.hours?.limitMinutes ?? null;
  const rating = details.review.rating;
  const seg = (on: boolean) => `px-3 py-1.5 text-sm ${on ? "bg-primary-tint font-medium text-primary-tint-text" : "text-zinc-600 hover:bg-surface-muted dark:text-zinc-400"}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/service" className="text-sm text-primary hover:underline">← Projects</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">{project.name}</h2>
          <ServiceStatusBadge status={project.status} />
          {details.inHouse && <span className="rounded-full border border-border-subtle px-2 py-0.5 text-xs text-zinc-500">In-house</span>}
        </div>
        {project.description && <p className="mt-2 max-w-2xl text-sm text-zinc-500">{project.description}</p>}
      </div>

      <nav aria-label="Project sections" className="flex gap-1 border-b border-border-subtle">
        {[{ id: "overview", label: "Overview", href: base }, { id: "settings", label: "Settings", href: `${base}?view=settings` }].map((t) => {
          const on = (t.id === "settings") === settings;
          return (
            <Link key={t.id} href={t.href} aria-current={on ? "page" : undefined} className={`-mb-px border-b-2 px-3 py-2 text-sm ${on ? "border-primary font-medium text-primary" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"}`}>
              {t.label}
            </Link>
          );
        })}
      </nav>

      {!settings && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label={`Hours this ${unit}`}
              value={pw.hours ? fmtMinutes(pw.hours.completedMinutes) : "—"}
              meter={pw.hours && limit ? { value: pw.hours.completedMinutes, max: limit, over: pw.hours.overLimitMinutes > 0 } : undefined}
              sub={!pw.hours ? "No contract yet" : limit ? (pw.hours.overLimitMinutes > 0 ? `Over the ${fmtMinutes(limit)} limit by ${fmtMinutes(pw.hours.overLimitMinutes)}` : `${fmtMinutes(pw.hours.remainingMinutes ?? 0)} left of ${fmtMinutes(limit)}`) : "No limit set"}
              tone={pw.hours && pw.hours.overLimitMinutes > 0 ? "bad" : "default"}
            />
            <Metric
              label={`Amount this ${unit}`}
              value={amountPeriod !== null ? fmtUsd(amountPeriod) : "—"}
              sub={c ? (c.type === "FIXED" && c.hourlyRateCents == null ? (budgetTotal !== null ? "Valued at $15/h against the fixed price" : "Fixed price") : c.hourlyRateCents != null ? `${fmtUsd(c.hourlyRateCents)}/h` : "No hourly rate set") : undefined}
            />
            <Metric
              label="Total hours worked"
              value={fmtMinutes(used)}
              meter={budgetTotal !== null ? { value: used, max: budgetTotal, over: used > budgetTotal } : undefined}
              sub={budgetTotal !== null
                ? `${used > budgetTotal ? `Over the budget by ${fmtMinutes(used - budgetTotal)}` : `${fmtMinutes(budgetTotal - used)} left`} of ${fmtMinutes(budgetTotal)} (${fmtUsd(c!.fixedPriceCents!)} ÷ $15)`
                : revenueSoFar !== null ? `${fmtUsd(revenueSoFar)} earned so far${billedByHours ? " · billed by the hours" : ""}` : "No rate set"}
              tone={budgetTotal !== null && used > budgetTotal ? "bad" : "default"}
            />
            <Metric
              label="Client review"
              value={rating ? <span><span className="text-status-warning-icon">★</span> {rating.toFixed(1)}</span> : "Pending"}
              sub={rating ? details.review.comment || "Closing review" : "Given when the project closes"}
            />
          </div>

          {pw.hours && (pw.needsReview || pw.sharedClient) ? (
            <div className="space-y-2 text-sm">
              {pw.needsReview ? (
                <p className="rounded-lg border border-status-warning-icon/30 bg-status-warning-bg px-4 py-2 text-status-warning-text">
                  {pw.needsReview} entr{pw.needsReview === 1 ? "y" : "ies"} still to check on the <Link href="/service/review" className="underline">Review page</Link>. They already count.
                </p>
              ) : null}
              {pw.sharedClient ? (
                <p className="rounded-lg border border-border-subtle bg-surface-muted/50 px-4 py-2 text-zinc-600 dark:text-zinc-400">
                  This client has several contracts, so only hours assigned to this one on the Review page count here{pw.unassignedEntries ? ` (${pw.unassignedEntries} not assigned yet)` : ""}.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card
                title="Hours"
                subtitle={<>{periodText}{isCurrent && <span className="ml-2 rounded-full bg-primary-tint px-2 py-0.5 text-[11px] font-medium text-primary-tint-text">now</span>}</>}
                action={
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <div className="inline-flex overflow-hidden rounded-lg border border-border-subtle">
                      <Link href={`${base}${q(wk ?? undefined, teamOnly, false)}`} aria-current={!byMonth ? "page" : undefined} className={`border-r border-border-subtle ${seg(!byMonth)}`}>Week</Link>
                      <Link href={`${base}${q(wk ?? undefined, teamOnly, true)}`} aria-current={byMonth ? "page" : undefined} className={seg(byMonth)}>Month</Link>
                    </div>
                    <Link href={`${base}${q(prevOn)}`} aria-label={`Previous ${unit}`} className={navBtn}>←</Link>
                    <Link href={`${base}${q(nextOn)}`} aria-label={`Next ${unit}`} className={navBtn}>→</Link>
                    {!isCurrent && <Link href={`${base}${q()}`} className="text-primary hover:underline">This {unit}</Link>}
                    <form action={base} method="get" className="flex items-center gap-2">
                      {byMonth && <input type="hidden" name="by" value="month" />}
                      {teamOnly && <input type="hidden" name="hours" value="team" />}
                      <label htmlFor="period-pick" className="sr-only">Choose a {unit}</label>
                      {byMonth
                        ? <input id="period-pick" type="month" name="on" defaultValue={pw.week.start.slice(0, 7)} max={todayIso.slice(0, 7)} className="rounded-lg border border-border-subtle bg-surface px-2 py-1" />
                        : <input id="period-pick" type="date" name="on" defaultValue={pw.week.start} max={todayIso} className="rounded-lg border border-border-subtle bg-surface px-2 py-1" />}
                      <button className={navBtn}>Go</button>
                    </form>
                  </div>
                }
              >
                <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-border-subtle text-sm" role="group" aria-label="Whose hours to count">
                  <Link href={`${base}${q(wk ?? undefined, false)}`} aria-current={!teamOnly ? "true" : undefined} className={`border-r border-border-subtle ${seg(!teamOnly)}`}>Everyone</Link>
                  <Link href={`${base}${q(wk ?? undefined, true)}`} aria-current={teamOnly ? "true" : undefined} className={seg(teamOnly)}>My team only</Link>
                </div>
                {pw.hours && pw.byDay ? (
                  <div className="space-y-4">
                    <DayBars days={pw.byDay} month={byMonth} />
                    {pw.bySender && pw.bySender.length > 0 && (
                      <ul className="flex flex-wrap gap-2">
                        {pw.bySender.map((p) => (
                          <li key={p.name} className="flex items-center gap-2 rounded-full border border-border-subtle bg-surface-muted/40 py-1 pl-1 pr-3 text-sm">
                            <Avatar name={p.name} />{outsider(p.name)}{p.name}<span className="tabular-nums text-zinc-500">{fmtMinutes(p.minutes)}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="text-xs text-zinc-500">
                      Tracked {fmtMinutes(pw.hours.trackedMinutes)} · manual {fmtMinutes(pw.hours.manualMinutes)}. Reported hours, not Upwork-verified; a report shared across projects counts here only for this project&apos;s share.
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500">No contract yet. Add one under Settings to see hours.</p>
                )}
              </Card>

              <Card title="Who worked how much" subtitle="* = not in the Digital Marketing team">
                <TeamHoursTable rows={team_.rows} months={team_.months} periodText={periodText} unit={unit} starred={outsider} compact />
              </Card>
            </div>

            <aside className="space-y-4">
              <Card title="Details">
                <dl>
                  <Row label="Type">{c ? (c.type === "HOURLY" ? "Hourly" : billedByHours ? "Fixed, billed by hours" : "Fixed price") : "—"}</Row>
                  <Row label={c?.type === "FIXED" && !billedByHours ? "Fixed price" : "Hourly rate"}>
                    {c?.type === "FIXED" && !billedByHours ? (c.fixedPriceCents != null ? fmtUsd(c.fixedPriceCents) : "—") : c?.hourlyRateCents != null ? `${fmtUsd(c.hourlyRateCents)}/h` : "—"}
                  </Row>
                  {billedByHours && <Row label="First fixed price">{c!.fixedPriceCents != null ? fmtUsd(c!.fixedPriceCents) : "—"}</Row>}
                  <Row label="Weekly hours">{c?.weeklyLimitMinutes ? fmtMinutes(c.weeklyLimitMinutes) : "—"}</Row>
                  <Row label="Upwork profile">{details.upworkProfile?.name ?? "—"}</Row>
                  <Row label="Written in Chat as">{details.chatKeywords.join(", ") || "—"}</Row>
                </dl>
              </Card>

              <Card title="People">
                <div className="-my-2 divide-y divide-border-subtle">
                  <PeopleLine role="Project manager" names={managers.map((m) => m.user.displayName)} empty="Unassigned" />
                  <PeopleLine role="Business analyst" names={uniqueBa(details.businessAnalysts.map((x) => x.name))} empty="None listed" />
                  <PeopleLine role="Business developer" names={uniqueBd(details.businessDevelopers.map((x) => x.name))} empty="None listed" />
                  <PeopleLine role="Executives" names={details.executives.map((x) => x.name)} empty="None listed" />
                  {team.length > 0 && <PeopleLine role="Team" names={team.map((m) => m.user.displayName)} empty="" />}
                </div>
              </Card>

              {details.upworkContracts.length > 0 && (
                <Card title={`Upwork contracts (${details.upworkContracts.length})`} subtitle="From the company contract list">
                  <ul className="-my-2 divide-y divide-border-subtle text-sm">
                    {details.upworkContracts.map((k) => (
                      <li key={k.ref} className="py-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{k.profile ?? "No profile"}</span>
                          {k.endDate ? <span className="text-xs text-zinc-500">Ended {k.endDate}</span> : <span className="rounded-full bg-status-pass-bg px-2 py-0.5 text-[11px] font-medium text-status-pass-text">Running</span>}
                        </div>
                        <div className="mt-0.5 text-xs text-zinc-500">
                          Started {k.startDate ?? "—"}{k.bde ? ` · BD ${k.bde}` : ""}{k.ba ? ` · BA ${k.ba}` : ""}{k.endedBy ? ` · ended by ${k.endedBy}` : ""}{k.rating !== null ? ` · ${k.rating.toFixed(1)}★` : ""}
                          {k.url && <> · <a href={k.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Upwork</a></>}
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!["COMPLETED", "CANCELLED", "ARCHIVED"].includes(project.status) && details.upworkContracts.every((k) => k.endDate) && (
                    <p className="mt-3 text-xs text-status-pass-text">Rehired: the last contract ended on {details.upworkContracts.map((k) => k.endDate!).sort().at(-1)}, but the team has worked on it since, so it stays open.</p>
                  )}
                </Card>
              )}
            </aside>
          </div>
        </>
      )}

      {settings && (
        <div className="space-y-6">
          <section aria-label="Status" className={SECTION}>
            <StatusControl projectId={project.id} status={project.status} />
          </section>

          <section aria-labelledby="edit" className={SECTION}>
            <h3 id="edit" className="mb-3 font-medium">Edit details</h3>
            <div className="space-y-4">
              <PeopleEditor key={`p:${details.businessAnalysts.map((x) => x.name).join()}|${details.executives.map((x) => x.name).join()}|${details.businessDevelopers.map((x) => x.name).join()}`} projectId={project.id} details={details} />
              <ReviewEditor key={`r:${details.review.rating}:${details.review.comment}`} projectId={project.id} details={details} />
              <ProfileEditor key={`u:${details.upworkProfile?.id}`} projectId={project.id} details={details} />
              <InHouseEditor key={`h:${details.inHouse}`} projectId={project.id} details={details} />
              <KeywordsEditor key={`k:${details.chatKeywords.join()}`} projectId={project.id} details={details} />
              <p className="text-xs text-zinc-500">Project manager is set under Edit assignments below. Project type, hourly rate and weekly hours are in the Contract box.</p>
            </div>
          </section>

          <section aria-labelledby="contract" className={SECTION}>
            <h3 id="contract" className="mb-3 font-medium">Contract</h3>
            <ContractEditor
              key={`${pw.contract?.type}:${pw.contract?.weeklyLimitMinutes}:${pw.contract?.status}:${pw.contract?.externalRef}:${pw.contract?.hourlyRateCents}:${pw.contract?.fixedPriceCents}:${pw.contract?.trackingMode}`}
              projectId={project.id}
              contract={pw.contract}
            />
          </section>

          <section aria-labelledby="assign" className={SECTION}>
            <h3 id="assign" className="mb-3 font-medium">Edit assignments</h3>
            {/* key forces a fresh editor state after a save refreshes the server data */}
            <AssignmentsEditor
              key={assignments.map((a) => `${a.userId}:${a.assignmentRole}`).sort().join(",")}
              projectId={project.id}
              users={users}
              current={assignments.map((a) => ({ userId: a.userId, role: a.assignmentRole }))}
            />
          </section>
        </div>
      )}
    </div>
  );
}

/** "*" before the name of someone outside the Digital Marketing team (their hours count because they are on this project). */
const outsider = (name: string) => (dmMatch(name) ? "" : "*");
