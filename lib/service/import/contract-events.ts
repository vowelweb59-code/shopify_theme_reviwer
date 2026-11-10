// Contract events posted in the Chat space "New Project Updates":
//   "Accepted the contract of <Client> - <Profile> - $15 Hourly - <BDE>"   (also "project", "offer", "$900 Fixed", "$10/hr")
//   "Contract ended of <Client> with 5-star ratings on <Profile>"          (also "5 Star - Profile", "4.7 star rating")
// Pure: one message in, one event (or null) out. A bare "$1100" with no Hourly/Fixed word is not guessed.
import { istDate } from './text';

export interface ContractEvent {
  kind: 'ACCEPTED' | 'ENDED';
  date: string; // IST day of the message
  client: string;
  profile: string | null;
  rateDollars: number | null; // hourly rate
  fixedDollars: number | null; // fixed-price amount
  rating: number | null;
  /** Accepted messages: the business developer named at the end (null when none is named or the contract is recurring). */
  bd: string | null;
  /** Accepted messages: marked "Recurring" (a rehire; credited to the original BD, so no BD is read from it). */
  recurring: boolean;
}

const SEP = /\s+[-–—]+\s+|\s*\|\s*|\s+[-–—]{2,}\s+/;
const clean = (s: string) => s.replace(/\([^)]*\)/g, ' ').replace(/^[\s:,.-]+|[\s:,.-]+$/g, '').replace(/\s+/g, ' ').trim();

/** A business developer as the platform spells them, from how a message writes them ("Aliasger Ezzi", "Ashfaque Sir (App)"). */
export function canonicalBd(raw: string): string | null {
  const words = raw.replace(/\([^)]*\)/g, ' ').toLowerCase().split(/[^a-z]+/).filter((w) => w && !['sir', 'maam', 'madam', 'mam', 'app', 'bd', 'bde'].includes(w));
  const first = words[0];
  if (!first) return null;
  if (/^aliasg?[ea]r$|^aliager$|^aliasgher$/.test(first)) {
    const rest = words.slice(1).join(' ');
    return /^(b|bagichawala|bagichwala)$/.test(rest) ? 'Aliasger B' : 'Aliasger'; // Aliasger Ezzi and a plain Aliasger are the same BD
  }
  const names: Record<string, string> = { amreen: 'Amreen', ashfaque: 'Ashfaque', ashfaq: 'Ashfaque', pranit: 'Pranit', preeti: 'Preeti', priti: 'Preeti', manasvi: 'Manasvi', shadab: 'Shadab', ghorse: 'Ghorse', ashay: 'Ashay', kaustubh: 'Kaustubh', sonal: 'Sonal', harsha: 'Harsha', mohit: 'Mohit Panpalia', mohammad: 'Mohammed Taher', mohammed: 'Mohammed Taher', mohd: 'Mohammed Taher' };
  return names[first] ?? null;
}

/** One message to an event, or null when it is not a contract event (or too garbled to trust). */
export function parseEvent(text: string, createTime: string): ContractEvent | null {
  const t = text.replace(/\s+/g, ' ').trim();
  const date = istDate(new Date(createTime));
  const acc = /accepted the (?:contract|project|offer)\s+(?:of\s+)?(.+?)(?=\s+contract ended\b|$)/i.exec(t);
  const end = /contract\s+(?:has been\s+)?ended\s+(?:of\s+)?(.+)$/i.exec(t);
  if (acc && !/^@/.test(t)) {
    // "Harun Ketenci- Hassan- $10- Hourly": a dash followed by a space is a separator even with no space before it
    const parts = acc[1]!.replace(/(\S)([-–—])\s+/g, '$1 $2 ').split(SEP).map((x) => x.trim()).filter(Boolean);
    // "Dan Banks -Batul - $900 Fixed": a dash with no space after it still ends the client name
    const [head = '', ...tight] = (parts[0] ?? '').split(/\s+[-–—](?=\S)/);
    if (tight.length) parts.splice(1, 0, tight.join(' '));
    const client = clean(head);
    if (client.length < 3 || /\bto\b.*\bteam\b/i.test(client)) return null;
    const body = parts.slice(1).join(' | ');
    // The amount and its word may sit in different parts ("Fixed - $500", "$10 - Hourly"), so read them with the separators flattened.
    const flat = body.replace(/\s*\|\s*/g, ' ').replace(/\s+[-–—]+\s+/g, ' ');
    const fixed = /\$\s?(\d[\d,]*(?:\.\d+)?)\s*-?\s*fixed|fixed\s*(?:price)?\s*[-:]?\s*\$\s?(\d[\d,]*(?:\.\d+)?)/i.exec(flat);
    // An explicit per-hour figure wins over an amount that merely sits next to the word (\"Fixed $100 - Hourly $20/hr\").
    const hourly = /\$\s?(\d+(?:\.\d+)?)\s*(?:\/\s*h(?:ou)?r|per\s*hour)/i.exec(flat) ?? /\$\s?(\d+(?:\.\d+)?)\s*-?\s*hourly|hourly\s*[-:]?\s*\$\s?(\d+(?:\.\d+)?)/i.exec(flat);
    // The BD is the last part that names one (after the amount); "Recurring" means a rehire, credited to the original BD.
    const recurring = /\brecurring\b/i.test(body);
    // "Fixed $10- Amreen": a dash with no space before it still separates the BD
    const tail = parts.slice(2).flatMap((x) => x.split(/[-–—]\s+(?=[A-Za-z])/)).reverse();
    const bd = recurring ? null : tail.map(canonicalBd).find((n) => n !== null) ?? null;
    return {
      kind: 'ACCEPTED', date, client, profile: parts[1] ? clean(parts[1]) : null,
      rateDollars: hourly ? Number(hourly[1] ?? hourly[2]) : null,
      fixedDollars: !hourly && fixed ? Number((fixed[1] ?? fixed[2])!.replace(/,/g, '')) : null,
      rating: null, bd, recurring,
    };
  }
  if (end) {
    const rest = end[1]!;
    const star = /(\d(?:\.\d+)?)\s*-?\s*star/i.exec(rest);
    const cut = rest.search(/,|\s+with\b|\s+\d(?:\.\d+)?\s*-?\s*star|\s+[-–—]\s+\d/i);
    const client = clean(cut > 0 ? rest.slice(0, cut) : rest);
    if (client.length < 3 || client.length > 60) return null;
    const on = /\bon\s+([A-Za-z][A-Za-z .]*?)(?=\s*(?:[(|\-–—,]|for\b|$))/.exec(rest) ?? /star(?:s)?(?:\s+ratings?)?\s*[-–—]\s*([A-Za-z]+)/i.exec(rest);
    const rating = star ? Number(star[1]) : null;
    return { kind: 'ENDED', date, client, profile: on ? clean(on[1]!) : null, rateDollars: null, fixedDollars: null, rating: rating !== null && rating >= 0 && rating <= 5 ? rating : null, bd: null, recurring: false };
  }
  return null;
}

