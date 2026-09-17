"use client";

import Link from "next/link";
import type { ScoreCard } from "@/lib/themes/computeScoreboard";

function scoreTone(score: number | null) {
  if (score === null) return "text-zinc-400";
  if (score >= 90) return "text-status-pass-text";
  if (score >= 70) return "text-status-warning-text";
  return "text-status-fail-text";
}

// "Features" links straight to the existing cross-theme feature checklist
// page rather than anything inside this Theme Detail view — that page
// isn't scoped by audit run/tab the way the other 7 cards are.
function CardHeading({ card, onNavigate }: { card: ScoreCard; onNavigate?: (card: ScoreCard) => void }) {
  const className = "text-sm font-medium text-zinc-700 underline decoration-dotted hover:text-primary dark:text-zinc-300";
  if (card.id === "features") {
    return (
      <Link href="/available-features" className={className}>
        {card.label}
      </Link>
    );
  }
  return (
    <button type="button" onClick={() => onNavigate?.(card)} className={className}>
      {card.label}
    </button>
  );
}

/**
 * The Lighthouse-style scoreboard replacing the flat Checks/Passed/Failed/
 * Warnings/Not-tested row — 8 independent scores (see
 * lib/themes/computeScoreboard.ts for how each is derived). There's no
 * single "view full report" link any more: each card's own heading is the
 * link into that specific slice of the report (All Checks filtered to a
 * category, the Report tab's Findings or Future-updates section, or the
 * standalone Features page) — see onNavigate below.
 */
export function ScoreboardGrid({ cards, onNavigate }: { cards: ScoreCard[]; onNavigate?: (card: ScoreCard) => void }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <div key={card.id} className="flex flex-col gap-1 rounded-lg border border-border-subtle p-4">
          <CardHeading card={card} onNavigate={onNavigate} />
          <div className={`text-2xl font-semibold ${scoreTone(card.score)}`}>{card.score === null ? "N/A" : `${card.score}%`}</div>
          <p className="text-xs text-zinc-500">{card.detail}</p>
        </div>
      ))}
    </div>
  );
}
