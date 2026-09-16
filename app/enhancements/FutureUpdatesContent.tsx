"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TIER_ORDER, TIER_LABELS, TIER_BLURBS } from "@/lib/enhancements/tiers";

type Example = { theme: string; note: string; version: string | null; date: string | null };

type EnhancementPoint = {
  _id: string;
  pointId: string;
  name: string;
  category: string;
  description: string;
  auditHint: string | null;
  source: "theme-store-trend" | "native-capability";
  // theme-store-trend only
  adoptionTier: string | null;
  themeCount: number | null;
  themeTotal: number | null;
  adoptionPercentage: number | null;
  noteCount: number | null;
  addedNoteCount: number | null;
  firstSeen: string | null;
  lastSeen: string | null;
  examples: Example[];
  // native-capability only
  appCategoryReplaced: string | null;
  nativeCapabilityCompleteness: "full" | "partial" | null;
  sourceName: string | null;
  sourceUrl: string | null;
  status: string;
  notes: string | null;
};

const TIER_STYLES: Record<string, string> = {
  established: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  common: "bg-sky-500/10 text-sky-700 dark:text-sky-400",
  emerging: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  experimental: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
};

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  planned: "Planned",
  implemented: "Implemented",
  dismissed: "Not applicable",
};

const STATUSES = ["backlog", "planned", "implemented", "dismissed"] as const;

const SOURCE_LABELS: Record<string, string> = {
  "theme-store-trend": "Theme Store trend",
  "native-capability": "Native capability (no app)",
};

function PointCard({
  point,
  isOpen,
  onToggle,
  onUpdate,
  saving,
}: {
  point: EnhancementPoint;
  isOpen: boolean;
  onToggle: () => void;
  onUpdate: (patch: { status?: string; notes?: string | null }) => void;
  saving: boolean;
}) {
  const isNative = point.source === "native-capability";

  return (
    <li className="rounded-lg border border-black/[.08] dark:border-white/[.145]">
      <button onClick={onToggle} aria-expanded={isOpen} className="flex w-full items-start gap-3 p-4 text-left">
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-zinc-950 dark:text-zinc-50">{point.name}</span>
            {isNative && point.appCategoryReplaced && (
              <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-xs text-violet-700 dark:text-violet-400">
                Replaces: {point.appCategoryReplaced}
              </span>
            )}
            {isNative && point.nativeCapabilityCompleteness === "partial" && (
              <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">
                Partially appless
              </span>
            )}
            {point.adoptionTier ? (
              <span className={`rounded-full px-2 py-0.5 text-xs ${TIER_STYLES[point.adoptionTier] ?? ""}`}>
                {point.adoptionPercentage}% · {point.themeCount}/{point.themeTotal} themes
              </span>
            ) : (
              isNative && (
                <span className="rounded-full bg-zinc-500/10 px-2 py-0.5 text-xs text-zinc-500">
                  Adoption not reliably measurable
                </span>
              )
            )}
            {point.status !== "backlog" && (
              <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
                {STATUS_LABELS[point.status]}
              </span>
            )}
          </span>
          <span className="font-mono text-xs text-zinc-500">
            {point.pointId} · {point.category}
            {point.firstSeen && ` · first seen ${point.firstSeen}`}
          </span>
        </span>
        <span aria-hidden className="pt-1 text-zinc-400">
          {isOpen ? "−" : "+"}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-4 border-t border-black/[.08] p-4 text-sm dark:border-white/[.145]">
          <p className="text-zinc-700 dark:text-zinc-300">{point.description}</p>

          {point.auditHint && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">What to check</h3>
              <p className="mt-1 text-zinc-700 dark:text-zinc-300">{point.auditHint}</p>
            </div>
          )}

          {isNative && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Official documentation</h3>
              {point.sourceUrl ? (
                <a
                  href={point.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-zinc-700 underline hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-zinc-50"
                >
                  {point.sourceName ?? point.sourceUrl}
                </a>
              ) : (
                <p className="mt-1 text-zinc-500">No source recorded.</p>
              )}
            </div>
          )}

          {point.adoptionTier ? (
            <>
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-500">
                <span>{point.noteCount} matching release notes</span>
                <span>{point.addedNoteCount} under an “Added”/“New” heading</span>
                {point.firstSeen && <span>First seen {point.firstSeen}</span>}
                {point.lastSeen && <span>Last seen {point.lastSeen}</span>}
              </div>

              {point.examples.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Release-note evidence</h3>
                  <ul className="mt-2 flex flex-col gap-2">
                    {point.examples.map((ex, i) => (
                      <li key={`${ex.theme}-${i}`} className="rounded-md bg-black/[.03] p-3 text-xs dark:bg-white/[.04]">
                        <span className="font-mono text-zinc-500">
                          {ex.theme}
                          {ex.version && ` v${ex.version}`}
                          {ex.date && ` · ${ex.date}`}
                        </span>
                        <p className="mt-1 text-zinc-700 dark:text-zinc-300">{ex.note}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            isNative && (
              <p className="text-xs text-zinc-500">
                No release-note adoption measurement for this point — see the description for why.
              </p>
            )
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-black/[.06] pt-3 dark:border-white/[.08]">
            <span className="text-xs text-zinc-500">Status</span>
            {STATUSES.map((s) => (
              <button
                key={s}
                disabled={saving}
                onClick={() => onUpdate({ status: s })}
                className={`rounded-md border px-2 py-1 text-xs disabled:opacity-50 ${
                  point.status === s
                    ? "border-transparent bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                    : "border-black/[.12] text-zinc-600 hover:border-black/30 dark:border-white/[.15] dark:text-zinc-400"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}
    </li>
  );
}

export function FutureUpdatesContent() {
  const [points, setPoints] = useState<EnhancementPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [sheetError, setSheetError] = useState<string | null>(null);
  const [sheetRecreated, setSheetRecreated] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/enhancements")
      .then((res) => res.json())
      .then((data) => {
        if (active) {
          setPoints(data.points ?? []);
          setSheetUrl(data.googleSheetUrl ?? null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  function exportToGoogleSheet() {
    setCreatingSheet(true);
    setSheetError(null);
    setSheetRecreated(false);
    fetch("/api/enhancements/export/google-sheet", { method: "POST" })
      .then((res) => res.json())
      .then((data) => {
        setCreatingSheet(false);
        if (data.error) setSheetError(data.error);
        else {
          setSheetUrl(data.url);
          setSheetRecreated(Boolean(data.recreated));
        }
      })
      .catch(() => {
        setCreatingSheet(false);
        setSheetError("Failed to update the Google Sheet.");
      });
  }

  const categories = useMemo(() => Array.from(new Set(points.map((p) => p.category))).sort(), [points]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return points.filter(
      (p) =>
        (!categoryFilter || p.category === categoryFilter) &&
        (!tierFilter || p.adoptionTier === tierFilter) &&
        (!statusFilter || p.status === statusFilter) &&
        (!sourceFilter || p.source === sourceFilter) &&
        (!q ||
          p.name.toLowerCase().includes(q) ||
          p.pointId.toLowerCase().includes(q) ||
          p.description.toLowerCase().includes(q) ||
          (p.appCategoryReplaced ?? "").toLowerCase().includes(q))
    );
  }, [points, categoryFilter, tierFilter, statusFilter, sourceFilter, search]);

  const trendPoints = useMemo(() => filtered.filter((p) => p.source === "theme-store-trend"), [filtered]);
  const nativePoints = useMemo(() => filtered.filter((p) => p.source === "native-capability"), [filtered]);

  const groupedByTier = useMemo(() => {
    const byTier: Record<string, EnhancementPoint[]> = {};
    for (const p of trendPoints) (byTier[p.adoptionTier ?? ""] ??= []).push(p);
    return byTier;
  }, [trendPoints]);

  const groupedNativeByCategory = useMemo(() => {
    const byCategory: Record<string, EnhancementPoint[]> = {};
    for (const p of nativePoints) (byCategory[p.category] ??= []).push(p);
    return byCategory;
  }, [nativePoints]);
  const nativeCategories = useMemo(() => Object.keys(groupedNativeByCategory).sort(), [groupedNativeByCategory]);

  const themeTotal = points.find((p) => p.source === "theme-store-trend")?.themeTotal ?? 0;
  const openCount = points.filter((p) => p.status === "backlog").length;
  const trendCount = points.filter((p) => p.source === "theme-store-trend").length;
  const nativeCount = points.filter((p) => p.source === "native-capability").length;

  async function updatePoint(pointId: string, patch: { status?: string; notes?: string | null }) {
    setSaving(pointId);
    const res = await fetch("/api/enhancements", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ pointId, ...patch }),
    });
    if (res.ok) {
      const { point } = await res.json();
      setPoints((prev) => prev.map((p) => (p.pointId === pointId ? { ...p, ...point } : p)));
    }
    setSaving(null);
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Future updates</h2>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
          Two kinds of points, both <strong>not</strong> approval requirements — nothing here affects submission
          readiness or requirement coverage. <strong>Theme Store trends</strong> are measured from what competing
          themes already ship. <strong>Native capabilities</strong> are documented Shopify features a theme can build
          without installing any app.
        </p>
      </div>

      {!loading && points.length > 0 && (
        <div className="flex flex-wrap gap-6 rounded-lg border border-black/[.08] p-5 text-sm dark:border-white/[.145]">
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{points.length}</div>
            <div className="text-zinc-500">Total points</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{trendCount}</div>
            <div className="text-zinc-500">Theme Store trends ({themeTotal} themes)</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{nativeCount}</div>
            <div className="text-zinc-500">Native capabilities</div>
          </div>
          <div>
            <div className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">{openCount}</div>
            <div className="text-zinc-500">Still in backlog</div>
          </div>
          <div className="flex flex-1 flex-col items-start justify-center gap-1 min-w-fit">
            <button
              type="button"
              onClick={exportToGoogleSheet}
              disabled={creatingSheet}
              className="rounded-full border border-black/[.12] px-3 py-1.5 text-xs text-zinc-700 hover:text-zinc-950 disabled:opacity-50 dark:border-white/[.15] dark:text-zinc-300 dark:hover:text-zinc-50"
            >
              {creatingSheet ? "Updating…" : sheetUrl ? "Update Google Sheet" : "Export to Google Sheet"}
            </button>
            {sheetError && (
              <p className="text-xs text-red-700 dark:text-red-300">
                {sheetError}{" "}
                {sheetError.includes("not connected") && (
                  <Link href="/settings" className="underline">
                    Connect it in Settings.
                  </Link>
                )}
              </p>
            )}
            {sheetUrl && !sheetError && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                {sheetRecreated ? "Sheet recreated" : "Sheet ready"} —{" "}
                <a href={sheetUrl} target="_blank" rel="noreferrer" className="underline">
                  open it
                </a>
                {sheetRecreated && " (the previous sheet was no longer accessible in Google Drive, so a new one was created)"}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search points…"
          className="min-w-48 flex-1 rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
        />
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
        >
          <option value="">Both sources</option>
          <option value="theme-store-trend">{SOURCE_LABELS["theme-store-trend"]}</option>
          <option value="native-capability">{SOURCE_LABELS["native-capability"]}</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        {sourceFilter !== "native-capability" && (
          <select
            value={tierFilter}
            onChange={(e) => setTierFilter(e.target.value)}
            className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
          >
            <option value="">All adoption tiers</option>
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>
                {TIER_LABELS[t]}
              </option>
            ))}
          </select>
        )}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-black/[.12] bg-transparent px-3 py-2 dark:border-white/[.15]"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}

      {!loading && points.length === 0 && (
        <div className="rounded-lg border border-dashed border-black/[.12] p-8 text-center text-sm text-zinc-500 dark:border-white/[.15]">
          <p className="font-medium text-zinc-700 dark:text-zinc-300">No enhancement points yet.</p>
          <p className="mt-2">
            Run <code className="font-mono">npm run harvest:trends</code> then{" "}
            <code className="font-mono">npm run seed:enhancements</code> for Theme Store trends, or{" "}
            <code className="font-mono">npm run seed:native-capabilities</code> for native capabilities.
          </p>
        </div>
      )}

      {!loading && trendPoints.length > 0 && (
        <section className="flex flex-col gap-6">
          <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Theme Store trends</h2>
          {TIER_ORDER.filter((tier) => groupedByTier[tier]?.length).map((tier) => (
            <div key={tier} className="flex flex-col gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                  {TIER_LABELS[tier]}
                  <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
                    {groupedByTier[tier].length}
                  </span>
                </h3>
                <p className="text-xs text-zinc-500">{TIER_BLURBS[tier]}</p>
              </div>
              <ul className="flex flex-col gap-2">
                {groupedByTier[tier].map((p) => (
                  <PointCard
                    key={p._id}
                    point={p}
                    isOpen={expanded === p.pointId}
                    onToggle={() => setExpanded(expanded === p.pointId ? null : p.pointId)}
                    onUpdate={(patch) => updatePoint(p.pointId, patch)}
                    saving={saving === p.pointId}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!loading && nativePoints.length > 0 && (
        <section className="flex flex-col gap-6 border-t border-black/[.08] pt-8 dark:border-white/[.145]">
          <div>
            <h2 className="text-xl font-semibold text-zinc-950 dark:text-zinc-50">Native capabilities (no app required)</h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Documented Shopify platform features — not Shopify Functions/Extensions or Flow, which still require
              deploying an app — a theme can implement with Liquid/JS/CSS alone, each replacing a category of paid app.
            </p>
          </div>
          {nativeCategories.map((category) => (
            <div key={category} className="flex flex-col gap-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
                {category}
                <span className="rounded-full bg-black/[.06] px-2 py-0.5 text-xs font-normal text-zinc-600 dark:bg-white/[.08] dark:text-zinc-400">
                  {groupedNativeByCategory[category].length}
                </span>
              </h3>
              <ul className="flex flex-col gap-2">
                {groupedNativeByCategory[category].map((p) => (
                  <PointCard
                    key={p._id}
                    point={p}
                    isOpen={expanded === p.pointId}
                    onToggle={() => setExpanded(expanded === p.pointId ? null : p.pointId)}
                    onUpdate={(patch) => updatePoint(p.pointId, patch)}
                    saving={saving === p.pointId}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {!loading && points.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-zinc-500">No points match those filters.</p>
      )}
    </div>
  );
}
