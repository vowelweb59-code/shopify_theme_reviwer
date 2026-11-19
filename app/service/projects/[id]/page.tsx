import Link from "next/link";
import type { ReactNode } from "react";
import { dmMatch } from "@/lib/service/dm-members";
import { workableMinutes } from "@/lib/service/hours/fixed-budget";
import { load } from "@/lib/service/api/http";
import { projectWeek, teamHours } from "@/lib/service/api/hours";
import { assignableUsers, getAssignments, getDetails, getProject, type AssignmentView } from "@/lib/service/api/projects";
import { fmtLongDay, fmtMinutes, fmtUsd, HoursBar, ServiceStatusBadge, shiftWeek, weekLabel } from "@/lib/service/ui/format";
import { AssignmentsEditor } from "./_components/AssignmentsEditor";
import { ContractEditor } from "./_components/ContractEditor";
import { InHouseEditor, KeywordsEditor, PeopleEditor, ProfileEditor, ReviewEditor } from "./_components/DetailsEditors";
import { StatusControl } from "./_components/StatusControl";

export const dynamic = "force-dynamic";

const SECTION = "rounded-lg border border-border-subtle bg-surface p-4";

export default async function ServiceProjectPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ week?: string; view?: string; hours?: string }> }) {
  const { id } = await params;
  const { week, view, hours: scope } = await searchParams;
  const teamOnly = scope === "team";
  const settings = view === "settings";
  const wk = week && /^\d{4}-\d{2}-\d{2}$/.test(week) ? week : null;
  const [project, assignments, pw, details, team_, users] = await load(() =>
    Promise.all([getProject(id), getAssignments(id), projectWeek(id, wk, teamOnly), getDetails(id), teamHours(id, wk, teamOnly), assignableUsers()])
  );
  const managers = assignments.filter((a) => a.assignmentRole === "MANAGER");
  const team = assignments.filter((a) => a.assignmentRole === "EMPLOYEE");
  const base = `/service/projects/${project.id}`;
  const q = (w?: string, h = teamOnly) => { const p = new URLSearchParams(); if (w) p.set("week", w); if (h) p.set("hours", "team"); return p.size ? `?${p}` : ""; };
  const navBtn = "rounded-md border border-border-subtle px-2 py-1 hover:bg-surface-muted";

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
          {pw.contract?.type === "FIXED" && pw.contract.hourlyRateCents != null && (() => {
            // Fixed price with an hourly rate: billed by the hours worked, no cap (scope grew past the first price).
            const used = team_.rows.reduce((n, r) => n + r.total, 0);
            return (
              <section aria-labelledby="budget" className={`${SECTION} border-l-4 border-l-status-info-icon`}>
                <h3 id="budget" className="mb-3 font-medium">Billed by the hours</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
                  <Fact label="Hours worked" value={fmtMinutes(used)} />
                  <Fact label="Rate" value={`${fmtUsd(pw.contract.hourlyRateCents!)}/h`} />
                  <Fact label="Revenue so far" value={fmtUsd(Math.round((used / 60) * pw.contract.hourlyRateCents!))} />
                  <Fact label="First fixed price" value={pw.contract.fixedPriceCents != null ? fmtUsd(pw.contract.fixedPriceCents) : "—"} />
                </dl>
                <p className="mt-2 text-xs text-zinc-500">The scope grew past the first fixed price, so the hours are billed at the hourly rate and there is no workable-hours limit.</p>
              </section>
            );
          })()}
          {pw.contract?.type === "FIXED" && pw.contract.hourlyRateCents == null && workableMinutes(pw.contract.fixedPriceCents) !== null && (() => {
            const total = workableMinutes(pw.contract.fixedPriceCents)!;
            const used = team_.rows.reduce((n, r) => n + r.total, 0);
            const over = used > total;
            return (
              <section aria-labelledby="budget" className={`${SECTION} border-l-4 ${over ? "border-l-status-fail-icon" : "border-l-status-info-icon"}`}>
                <h3 id="budget" className="mb-3 font-medium">Fixed budget in hours</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
                  <Fact label="Total workable hours" value={`${fmtMinutes(total)} (${fmtUsd(pw.contract.fixedPriceCents!)} ÷ $15)`} />
                  <Fact label="Hours used" value={fmtMinutes(used)} />
                  <Fact label={over ? "Over the budget by" : "Hours left"} value={fmtMinutes(Math.abs(total - used))} />
                  <Fact label="Revenue so far" value={`${fmtUsd(Math.round((used / 60) * 1500))} of ${fmtUsd(pw.contract.fixedPriceCents!)} (${Math.round((used / total) * 100)}%)`} />
                </dl>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                  <div className={`h-full ${over ? "bg-status-fail-icon" : used / total >= 0.8 ? "bg-status-warning-icon" : "bg-status-pass-icon"}`} style={{ width: `${Math.min(100, (used / total) * 100)}%` }} />
                </div>
                {over && <p className="mt-2 text-sm text-status-fail-text">The hours reported are past what the fixed price allows.</p>}
              </section>
            );
          })()}
          <section aria-labelledby="facts" className={SECTION}>
            <h3 id="facts" className="mb-3 font-medium">Project details</h3>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-4">
              <Fact label="Project type" value={pw.contract ? (pw.contract.type === "HOURLY" ? "Hourly" : "Fixed price") : "—"} />
              {pw.contract?.type === "FIXED" ? (
                <Fact label="Fixed price" value={pw.contract.fixedPriceCents != null ? fmtUsd(pw.contract.fixedPriceCents) : "—"} />
              ) : (
                <Fact label="Hourly rate" value={pw.contract?.hourlyRateCents != null ? fmtUsd(pw.contract.hourlyRateCents) : "—"} />
              )}
              <Fact
                label="Review"
                value={details.review.rating ? `${"★".repeat(Math.round(details.review.rating))}${"☆".repeat(5 - Math.round(details.review.rating))} ${details.review.rating.toFixed(1)}${details.review.comment ? ` · ${details.review.comment}` : ""}` : "Pending (project still running)"}
              />
              <Fact label="Weekly hours allotted" value={pw.contract?.weeklyLimitMinutes ? fmtMinutes(pw.contract.weeklyLimitMinutes) : "—"} />
              <Fact label="Time tracking" value={pw.contract?.trackingMode ? (pw.contract.trackingMode === "TIMER" ? "Timer" : "Manual") : "—"} />
              <Fact label="Upwork profile" value={details.upworkProfile?.name ?? "—"} />
              <Fact label="Written in Chat as" value={details.chatKeywords.join(", ") || "—"} />
            </dl>
          </section>

          <section aria-labelledby="hours" className={SECTION}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="hours" className="font-medium">Hours <span className="font-normal text-zinc-500">· {weekLabel(pw.week)}</span></h3>
              <nav aria-label="Week" className="flex gap-2 text-sm">
                <Link href={`${base}${q(shiftWeek(pw.week.start, -1))}`} className={navBtn}>← Previous</Link>
                <Link href={`${base}${q()}`} className={navBtn}>This week</Link>
                <Link href={`${base}${q(shiftWeek(pw.week.start, 1))}`} className={navBtn}>Next →</Link>
              </nav>
            </div>
            <p className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-zinc-500">Count hours of:</span>
              <Link href={`${base}${q(wk ?? undefined, false)}`} aria-current={!teamOnly ? "true" : undefined} className={`${navBtn} ${!teamOnly ? "bg-primary-tint text-primary-tint-text" : ""}`}>Everyone</Link>
              <Link href={`${base}${q(wk ?? undefined, true)}`} aria-current={teamOnly ? "true" : undefined} className={`${navBtn} ${teamOnly ? "bg-primary-tint text-primary-tint-text" : ""}`}>My team only</Link>
            </p>
            {pw.hours ? (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
                  <Fact label="Completed" value={fmtMinutes(pw.hours.completedMinutes)} />
                  <Fact label="Weekly limit" value={pw.hours.limitMinutes ? fmtMinutes(pw.hours.limitMinutes) : "Not set"} />
                  <Fact label="Left this week" value={pw.hours.overLimitMinutes > 0 ? `Over by ${fmtMinutes(pw.hours.overLimitMinutes)}` : pw.hours.remainingMinutes === null ? "—" : fmtMinutes(pw.hours.remainingMinutes)} />
                  <Fact label="Amount this week" value={pw.contract?.hourlyRateCents != null && !details.inHouse ? fmtUsd(Math.round((pw.hours.completedMinutes * pw.contract.hourlyRateCents) / 60)) : "—"} />
                  <Fact label="Tracked / manual" value={`${fmtMinutes(pw.hours.trackedMinutes)} / ${fmtMinutes(pw.hours.manualMinutes)}`} />
                </div>
                {pw.hours.limitMinutes ? <HoursBar hours={pw.hours} /> : null}
                {pw.needsReview ? (
                  <p className="text-sm text-status-warning-text">
                    {pw.needsReview} entr{pw.needsReview === 1 ? "y" : "ies"} still to check on the <Link href="/service/review" className="underline">Review page</Link>. They already count.
                  </p>
                ) : null}
                {pw.sharedClient && (
                  <p className="text-sm text-zinc-500">
                    This client has several contracts, so only hours assigned to this one on the Review page count here{pw.unassignedEntries ? ` (${pw.unassignedEntries} not assigned yet)` : ""}.
                  </p>
                )}
                {pw.byDay && pw.byDay.some((d) => d.minutes > 0) && (
                  <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500">
                    {pw.byDay.map((d) => (
                      <li key={d.date}>
                        {new Date(`${d.date}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" })} {fmtMinutes(d.minutes)}
                      </li>
                    ))}
                  </ul>
                )}
                {pw.bySender && pw.bySender.length > 0 && <p className="text-sm text-zinc-500">By person: {pw.bySender.map((s) => `${outsider(s.name)}${s.name} ${fmtMinutes(s.minutes)}`).join(" · ")}</p>}
                <p className="text-xs text-zinc-500">Reported and tracked hours, not Upwork-verified.</p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No contract yet. Add one under Settings to see weekly hours.</p>
            )}
          </section>

          <section aria-labelledby="people" className={SECTION}>
            <h3 id="people" className="mb-3 font-medium">People</h3>
            <PeopleRow label="PM" people={managers} />
            <NamesRow label="BA" names={details.businessAnalysts.map((x) => x.name)} />
            <NamesRow label="BD" names={details.businessDevelopers.map((x) => x.name)} />
            <NamesRow label="Executives" names={details.executives.map((x) => x.name)} />
            {team.length > 0 && <PeopleRow label="Team" people={team} />}
            <h4 className="mb-2 mt-4 text-sm font-medium">Who worked how much <span className="font-normal text-zinc-500">· * = not in the Digital Marketing team</span></h4>
            {team_.rows.length === 0 ? (
              <p className="text-sm text-zinc-500">No reports on this project yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="text-xs uppercase tracking-wide text-zinc-500">
                    <tr className="border-b border-border-subtle text-left">
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="py-2 pr-3 text-right font-medium">{weekLabel(pw.week)}</th>
                      <th className="py-2 pr-3 text-right font-medium">Last 30 days</th>
                      <th className="py-2 pr-3 text-right font-medium">All reported</th>
                      <th className="py-2 text-right font-medium">Last report</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {team_.rows.map((r) => (
                      <tr key={r.name}>
                        <td className="py-2 pr-3 font-medium">{outsider(r.name)}{r.name}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.week ? fmtMinutes(r.week) : <span className="text-zinc-400">—</span>}</td>
                        <td className="py-2 pr-3 text-right tabular-nums">{r.last30 ? fmtMinutes(r.last30) : <span className="text-zinc-400">—</span>}</td>
                        <td className="py-2 pr-3 text-right font-medium tabular-nums">{fmtMinutes(r.total)}</td>
                        <td className="py-2 text-right text-zinc-500">{fmtLongDay(r.lastReport)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {team_.months.length > 0 && (
              <>
                <h4 className="mb-2 mt-6 text-sm font-medium">Hours by month <span className="font-normal text-zinc-500">· newest month first</span></h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wide text-zinc-500">
                      <tr className="border-b border-border-subtle text-left">
                        <th className="py-2 pr-3 font-medium">Person</th>
                        {[...team_.months].reverse().map((m) => (
                          <th key={m} className="whitespace-nowrap py-2 pr-3 text-right font-medium">{new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}</th>
                        ))}
                        <th className="py-2 text-right font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border-subtle">
                      {team_.rows.map((r) => (
                        <tr key={r.name}>
                          <td className="whitespace-nowrap py-2 pr-3 font-medium">{outsider(r.name)}{r.name}</td>
                          {[...team_.months].reverse().map((m) => (
                            <td key={m} className="py-2 pr-3 text-right tabular-nums">{r.byMonth[m] ? fmtMinutes(r.byMonth[m]) : <span className="text-zinc-400">—</span>}</td>
                          ))}
                          <td className="py-2 text-right font-medium tabular-nums">{fmtMinutes(Object.values(r.byMonth).reduce((n, x) => n + x, 0))}</td>
                        </tr>
                      ))}
                      <tr className="font-medium">
                        <td className="py-2 pr-3">All people</td>
                        {[...team_.months].reverse().map((m) => (
                          <td key={m} className="py-2 pr-3 text-right tabular-nums">{fmtMinutes(team_.rows.reduce((n, r) => n + (r.byMonth[m] ?? 0), 0))}</td>
                        ))}
                        <td className="py-2 text-right tabular-nums">{fmtMinutes(team_.rows.reduce((n, r) => n + Object.values(r.byMonth).reduce((a, x) => a + x, 0), 0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <p className="mt-2 text-xs text-zinc-500">Reported and tracked hours, not Upwork-verified. A report shared across projects counts here only for this project&apos;s share.</p>
          </section>

          {details.upworkContracts.length > 0 && (
            <section aria-labelledby="contracts" className={SECTION}>
              <h3 id="contracts" className="font-medium">Upwork contracts <span className="font-normal text-zinc-500">({details.upworkContracts.length})</span></h3>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="border-b border-border-subtle text-left text-zinc-500">
                      {["Started", "Ended", "Profile", "BD", "BA", "Ended by", "Rating", "Link"].map((h) => <th key={h} className="py-2 pr-3 font-medium">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {details.upworkContracts.map((c) => (
                      <tr key={c.ref}>
                        <td className="py-2 pr-3">{c.startDate ?? "—"}</td>
                        <td className="py-2 pr-3">{c.endDate ?? <span className="text-status-pass-text">Running</span>}</td>
                        <td className="py-2 pr-3">{c.profile ?? "—"}</td>
                        <td className="py-2 pr-3">{c.bde ?? "—"}</td>
                        <td className="py-2 pr-3">{c.ba ?? "—"}</td>
                        <td className="py-2 pr-3">{c.endedBy ?? "—"}</td>
                        <td className="py-2 pr-3">{c.rating !== null ? c.rating.toFixed(1) : "—"}</td>
                        <td className="py-2">{c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">Upwork</a> : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!["COMPLETED", "CANCELLED", "ARCHIVED"].includes(project.status) && details.upworkContracts.every((c) => c.endDate) && (
                <p className="mt-2 text-sm text-status-pass-text">
                  Rehired: the last contract ended on {details.upworkContracts.map((c) => c.endDate!).sort().at(-1)}, but the team has worked on it since, so it stays open.
                </p>
              )}
              <p className="mt-2 text-xs text-zinc-500">From the company contract list. A project counts as closed when all its contracts have ended and nobody has worked on it since.</p>
            </section>
          )}
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

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/** "*" before the name of someone outside the Digital Marketing team (their hours count because they are on this project). */
const outsider = (name: string) => (dmMatch(name) ? "" : "*");

function PeopleRow({ label, people }: { label: string; people: AssignmentView[] }) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-20 text-zinc-500">{label}</span>
      <span>{people.length ? people.map((p) => p.user.displayName).join(", ") : <span className="text-zinc-500">Unassigned</span>}</span>
    </div>
  );
}

function NamesRow({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="flex gap-3 py-1 text-sm">
      <span className="w-20 shrink-0 text-zinc-500">{label}</span>
      <span>{names.length ? names.join(", ") : <span className="text-zinc-500">None listed</span>}</span>
    </div>
  );
}
