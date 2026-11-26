// Rule-based reading of a whole Chat space for pending tasks and pitch opportunities (owner, 2026-11-26, temporary tab "Space scan").
// No AI service is involved: a message is picked by wording cues, so it finds candidates for a person to read, not certain answers.

export interface SpaceMessage {
  id: string;
  sender: string;
  postedAt: string;
  text: string;
}

export interface SpaceItem {
  id: string;
  sender: string;
  postedAt: string;
  text: string;
  /** Which wording cue picked it. */
  reason: string;
  /** Tasks only: a later message within a week says it is done and shares words with it. */
  likelyDone?: { by: string; at: string; text: string };
}

export interface SpaceInsights {
  scanned: number;
  from: string | null;
  to: string | null;
  tasks: SpaceItem[];
  doneTasks: number;
  opportunities: SpaceItem[];
}

const TASK_CUES: Array<[string, RegExp]> = [
  ["Asked to do something", /\b(please|pls|kindly)\b/i],
  ["Asked to do something", /\b(can|could|would|will) you\b/i],
  ["Action needed", /\b(need(s|ed)? to|have to|has to|must|make sure|don'?t forget)\b/i],
  ["To-do / action item", /\b(to-?do|action items?|follow[- ]?up|next steps?)\b/i],
  ["Pending", /\b(pending|outstanding|yet to|not (yet )?(done|completed|received|shared|started|updated))\b/i],
  ["Waiting", /\bwaiting (for|on)\b/i],
  ["Reminder", /\b(remind(er)?|reminding)\b/i],
  ["Deadline", /\b(deadline|due (on|by|date)|by (eod|end of day|tomorrow|today|tonight|monday|tuesday|wednesday|thursday|friday|saturday))\b/i],
  ["Promised", /\b(i|we)('ll| will) (share|send|check|update|do|get back|revert|look|work|try)\b/i],
];

const DONE_CUE = /\b(done|completed?|finished|fixed|resolved|sent|shared|updated|delivered|uploaded|submitted|closed|sorted|handled|published)\b/i;

const OPPORTUNITY_CUES: Array<[string, RegExp]> = [
  ["Client asks for more", /\b(client|customer|they|he|she)\b.{0,40}\b(wants?|asked|asking|looking for|interested in|requested|needs?|planning)\b/i],
  ["Client asks for more", /\b(wants?|looking|planning|interested) (to|in) (add|build|redesign|improve|launch|expand|start|migrate|revamp)/i],
  ["Upsell idea", /\b(up-?sell|cross-?sell|pitch|propose|proposal|suggest(ed)? (to|a|an|the))\b/i],
  ["Upsell idea", /\bcan we (offer|pitch|do|build|add|sell)\b/i],
  [
    "More work / next phase",
    /\b(next phase|phase ?2|another project|more work|additional (work|pages|features|hours)|new (project|requirement|feature|store|website|app)|extend|expansion|retainer|maintenance (plan|package)|redesign|migration|revamp)\b/i,
  ],
  ["Lead", /\b(new lead|inquiry|enquiry|prospect|potential (client|customer)|referral|referred|recommend(ed)? us)\b/i],
  [
    "Problem we can solve",
    /\b(slow (site|store|speed)|not (ranking|converting)|low (traffic|conversion|sales|ranking)|bounce rate|drop in (traffic|sales|ranking)|abandoned cart)\b/i,
  ],
];

const STOP = new Set(
  "this that with from have will your they them then than when what which would could should about there their were been into also just very more some here only over such like".split(
    " "
  )
);

function words(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 4 && !STOP.has(w))
  );
}

function firstCue(text: string, cues: Array<[string, RegExp]>): string | null {
  for (const [label, re] of cues) if (re.test(text)) return label;
  return null;
}

const WEEK = 7 * 24 * 3600 * 1000;
const MIN_LENGTH = 20;
const SNIPPET = 500;
export const MAX_ITEMS = 500;

/** Messages must be oldest first. Returns the newest items first, capped at MAX_ITEMS each. */
export function analyseSpace(messages: readonly SpaceMessage[]): SpaceInsights {
  const tasks: SpaceItem[] = [];
  let doneTasks = 0;
  const opportunities: SpaceItem[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    const text = m.text.trim();
    if (text.length < MIN_LENGTH) continue;
    const base = { id: m.id, sender: m.sender, postedAt: m.postedAt, text: text.length > SNIPPET ? `${text.slice(0, SNIPPET)}…` : text };

    const task = firstCue(text, TASK_CUES);
    if (task) {
      const mine = words(text);
      const t0 = +new Date(m.postedAt);
      let done: SpaceItem["likelyDone"];
      for (let j = i + 1; j < messages.length && +new Date(messages[j].postedAt) - t0 <= WEEK; j++) {
        const later = messages[j];
        if (!DONE_CUE.test(later.text)) continue;
        let shared = 0;
        for (const w of words(later.text)) if (mine.has(w) && ++shared >= 2) break;
        if (shared >= 2) {
          done = { by: later.sender, at: later.postedAt, text: later.text.slice(0, 200) };
          break;
        }
      }
      if (done) doneTasks++;
      else tasks.push({ ...base, reason: task });
    }

    const opp = firstCue(text, OPPORTUNITY_CUES);
    if (opp) opportunities.push({ ...base, reason: opp });
  }
  const newest = (a: SpaceItem, b: SpaceItem) => +new Date(b.postedAt) - +new Date(a.postedAt);
  return {
    scanned: messages.length,
    from: messages[0]?.postedAt ?? null,
    to: messages[messages.length - 1]?.postedAt ?? null,
    tasks: tasks.sort(newest).slice(0, MAX_ITEMS),
    doneTasks,
    opportunities: opportunities.sort(newest).slice(0, MAX_ITEMS),
  };
}

/**
 * The whole space as plain text, grouped by Chat thread (threads in order of their first message, replies under their thread), for a
 * person or an AI assistant to read (owner, 2026-11-26): rule-based wording cues cannot tell whether a thread is settled, a reader can.
 * Times are IST. Messages must be oldest first.
 */
export function formatSpaceThreads(messages: ReadonlyArray<SpaceMessage & { threadName?: string }>): string {
  const ist = (iso: string) => new Date(+new Date(iso) + 330 * 60_000).toISOString().replace("T", " ").slice(0, 16);
  const threads = new Map<string, Array<SpaceMessage & { threadName?: string }>>();
  for (const m of messages) {
    const key = m.threadName ?? `single:${m.id}`;
    const list = threads.get(key);
    if (list) list.push(m);
    else threads.set(key, [m]);
  }
  const out: string[] = [];
  let n = 0;
  for (const list of threads.values()) {
    out.push(`=== THREAD ${++n} · ${list.length} message${list.length === 1 ? "" : "s"} · started ${ist(list[0].postedAt)} IST ===`);
    for (const m of list) out.push(`[${ist(m.postedAt)}] ${m.sender}: ${m.text.trim().replace(/\r?\n/g, "\n    ")}`);
    out.push("");
  }
  return out.join("\n");
}
