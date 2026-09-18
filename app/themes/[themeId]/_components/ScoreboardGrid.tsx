"use client";

import type { ScoreCard } from "@/lib/themes/computeScoreboard";

function scoreTone(score: number | null) {
  if (score === null) return "text-zinc-400";
  if (score >= 90) return "text-status-pass-text";
  if (score >= 70) return "text-status-warning-text";
  return "text-status-fail-text";
}

function CardHeading({ card, isExpanded, onToggle }: { card: ScoreCard; isExpanded: boolean; onToggle?: (card: ScoreCard) => void }) {
  const className = "text-sm font-medium text-zinc-700 underline decoration-dotted hover:text-primary dark:text-zinc-300";
  return (
    <button type="button" onClick={() => onToggle?.(card)} aria-expanded={isExpanded} className={className}>
      {card.label}
    </button>
  );
}

// Each card gets its own accent color rather than one flat neutral tile —
// makes the 8-card grid scannable at a glance (which cards need attention)
// instead of every tile looking identical until you read the number.
const CARD_ACCENTS: Record<string, string> = {
  "desktop-performance": "border-t-4 border-t-sky-400",
  "mobile-performance": "border-t-4 border-t-indigo-400",
  accessibility: "border-t-4 border-t-purple-400",
  seo: "border-t-4 border-t-amber-400",
  "store-requirement": "border-t-4 border-t-rose-400",
  "internal-standards": "border-t-4 border-t-teal-400",
  features: "border-t-4 border-t-emerald-400",
  opportunities: "border-t-4 border-t-orange-400",
};

/**
 * The Lighthouse-style scoreboard replacing the flat Checks/Passed/Failed/
 * Warnings/Not-tested row — 8 independent scores (see
 * lib/themes/computeScoreboard.ts for how each is derived). Clicking any
 * card's heading toggles that card's issues open directly beneath the grid
 * — see OverviewPanel's renderExpanded for what's shown per card.
 */
export function ScoreboardGrid({
  cards,
  expandedCardId,
  onToggle,
  renderExpanded,
}: {
  cards: ScoreCard[];
  expandedCardId?: string | null;
  onToggle?: (card: ScoreCard) => void;
  renderExpanded?: (card: ScoreCard) => React.ReactNode;
}) {
  const expandedCard = cards.find((c) => c.id === expandedCardId) ?? null;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.id}
            className={`flex flex-col gap-1 rounded-lg border border-border-subtle bg-surface p-4 shadow-sm transition-colors ${CARD_ACCENTS[card.id] ?? ""} ${
              expandedCardId === card.id ? "ring-2 ring-primary/40" : ""
            }`}
          >
            <CardHeading card={card} isExpanded={expandedCardId === card.id} onToggle={onToggle} />
            <div className={`text-2xl font-semibold ${scoreTone(card.score)}`}>{card.score === null ? "N/A" : `${card.score}%`}</div>
            <p className="text-xs text-zinc-500">{card.detail}</p>
          </div>
        ))}
      </div>
      {expandedCard && renderExpanded && (
        <div className="rounded-lg border border-border-subtle bg-surface p-4">
          <h4 className="mb-3 text-sm font-semibold text-zinc-950 dark:text-zinc-50">{expandedCard.label} — issues</h4>
          {renderExpanded(expandedCard)}
        </div>
      )}
    </div>
  );
}
