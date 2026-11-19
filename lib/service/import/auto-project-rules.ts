// Pure naming rules for the automatic project creation (lib/service/chat/auto-projects.ts). Kept apart so they can be tested.
import { normalizeName } from "./text";

const key = normalizeName;
const LABEL_WORDS = new Set(["task", "tasks", "meeting", "call", "internal", "training", "review", "report", "study", "client", "clients", "na", "none", "test", "break", "leave", "holiday", "work"]);

/** Does a Chat post about `postClient` talk about `name`? Same name, or one is the other's leading words ("Ledty" / "Ledty LavishCo"). */
export function samePostClient(name: string, postClient: string): boolean {
  const a = key(name).split(" ");
  const b = key(postClient).split(" ");
  const n = Math.min(a.length, b.length);
  return n > 0 && a.slice(0, n).join(" ") === b.slice(0, n).join(" ") && (n >= 2 || a.join(" ").length >= 5);
}

/** A name that begins with / is begun by an existing client's name is probably that client written short, not a new one. */
export function nearExisting(name: string, existing: readonly string[]): string | null {
  const a = key(name).split(" ");
  for (const e of existing) {
    const b = key(e).split(" ");
    const n = Math.min(a.length, b.length);
    if (n > 0 && a.slice(0, n).join(" ") === b.slice(0, n).join(" ") && a.join(" ") !== b.join(" ")) return e;
  }
  return null;
}

export function looksLikeClientName(name: string): boolean {
  const k = key(name);
  if (k.length < 3 || k.length > 60 || /[:;]/.test(name) || !/[a-z]{2}/.test(k)) return false;
  return !k.split(" ").some((w, i) => i === 0 && LABEL_WORDS.has(w));
}

