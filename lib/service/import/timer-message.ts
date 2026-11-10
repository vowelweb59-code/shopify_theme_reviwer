// ON-timer stream: "<Client> | <Upwork profile> - TIMER ON|OFF". The Chat sender is the person the time belongs to.
// Unknown or ambiguous wording is reported, never guessed (docs/design/data-import.md).
import { editDistance, normalizeName } from './text';

export type TimerDirection = 'ON' | 'OFF';

export interface TimerMessage {
  id: string;
  senderId: string;
  /** Chat createTime (UTC ISO). The time typed in the text, if any, is never used. */
  createTime: string;
  text: string;
}

export interface TimerEvent {
  messageId: string;
  senderId: string;
  at: Date;
  direction: TimerDirection;
  client: string;
  clientKey: string;
  profile: string;
  profileKey: string;
  flags: string[];
}

export type TimerParse =
  | { kind: 'EVENT'; event: TimerEvent }
  | { kind: 'UNRECOGNIZED'; messageId: string; reason: 'BAD_FORMAT' | 'UNKNOWN_STATUS' | 'AMBIGUOUS_STATUS' }
  | { kind: 'IGNORED' };

const ON_WORDS = ['on', 'start', 'started', 'starting', 'begin', 'began', 'resume', 'resumed', 'resuming'];
const OFF_WORDS = ['off', 'stop', 'stopped', 'stopping', 'end', 'ended', 'finish', 'finished', 'pause', 'paused', 'close', 'closed'];
const FILLER = ['timer', 'time', 'the', 'is', 'has', 'was'];

// Split on the LAST dash that is followed by a space (it may touch the profile: "Ali Asger B- TIMER ON"), so hyphenated names still work.
const SHAPE = /^(.*?)\|(.*)\s*[-–—]\s+([^-–—]+?)\s*$/;
// Some people drop the pipe: "Pramesh Baskota - Ashfaque - TIMER ON". Client and profile then split on the last dash.
const SHAPE_NO_PIPE = /^(.*?)\s*[-–—]\s+([^-–—|]+?)\s+[-–—]\s+([^-–—]+?)\s*$/;

/** Exact match, or a one-character typo for words of 4+ letters ("stoped"). Short words must match exactly: "of" is not "on". */
function classify(token: string): { dir: TimerDirection; fuzzy: boolean } | null {
  if (/^on{2,}$/.test(token)) return { dir: 'ON', fuzzy: true }; // "onn"
  if (/^of{3,}$/.test(token)) return { dir: 'OFF', fuzzy: true }; // "offf" ("of" alone stays unknown)
  if (ON_WORDS.includes(token)) return { dir: 'ON', fuzzy: false };
  if (OFF_WORDS.includes(token)) return { dir: 'OFF', fuzzy: false };
  if (token.length < 4) return null;
  const near = (words: string[]) => words.some((w) => w.length >= 4 && editDistance(token, w) <= 1);
  const on = near(ON_WORDS);
  const off = near(OFF_WORDS);
  if (on === off) return null;
  return { dir: on ? 'ON' : 'OFF', fuzzy: true };
}

// The 2023 wording puts the profile in brackets and may start with a "Client:" label:
//   "Client: Axel Persson - (Burhan) Timer ON", "Hans Gerritsen:(Zainab Raja): TIMER ON",
//   "Client: (Viktoriya Hopperstad ) -Priti: Timer OFF" (client in the brackets, profile after).
const OLD_STATUS = /^(?:client\s*[:\-–—]+\s*)?(.+?)[\s:\-–—]*\b(tim\w*\s*[:\-–—]?\s*(?:on|off))\b[\s.!]*$/i;
const SEP = /^[\s:\-–—]+|[\s:\-–—]+$/g;
function parseOldShape(text: string): [string, string, string, string] | null {
  const m = OLD_STATUS.exec(text);
  if (!m) return null;
  const mid = m[1]!.trim();
  const lead = /^\(([^)]+)\)\s*[:\-–—]*\s*(.+)$/.exec(mid);
  if (lead) return [text, lead[1]!.replace(SEP, ''), lead[2]!.replace(SEP, ''), m[2]!];
  const tail = /^(.+?)\s*[:\-–—]*\s*\(([^)]+)\)$/.exec(mid);
  if (tail) return [text, tail[1]!.replace(SEP, ''), tail[2]!.replace(SEP, ''), m[2]!];
  return null;
}

// Last resort for lines the strict shapes miss: the status is the tail ("TIMER OFF", "Timer-ON"), whatever sits between the names
// and the status ("|", ":", a dash with or without spaces, nothing) is dropped, and the rest splits into client and profile on the
// first "|", else the last dash, else a lone "l" / "I" typed in place of the pipe. No separator at all stays unrecognized.
const STATUS_TAIL = /^(.*?)[\s|:\-–—]*\b(tim\w*\s*[:\-–—]?\s*(?:on|off))\b[\s.!]*$/i;
const LOOKALIKE_PIPE = /^(.+?)\s+[lI]\s+(.+)$/;
function parseLooseShape(text: string): [string, string, string, string] | null {
  const t = STATUS_TAIL.exec(text);
  if (!t) return null;
  const head = t[1]!.replace(SEP, '').replace(/\s+[lI]$/, '').trim(); // a look-alike pipe right before the status
  const split = (re: RegExp) => re.exec(head);
  const parts =
    (head.includes('|') ? split(/^(.*?)\|(.*)$/) : null) ??
    split(/^(.*\S)\s*[-–—]\s*(\S.*)$/) ??
    split(LOOKALIKE_PIPE);
  if (!parts) return null;
  const client = parts[1]!.replace(SEP, '');
  const profile = parts[2]!.replace(SEP, '');
  return client && profile ? [text, client, profile, t[2]!] : null;
}

export function parseTimerMessage(msg: TimerMessage): TimerParse {
  const text = msg.text.trim();
  const m = text.match(SHAPE) ?? (text.includes('|') ? null : text.match(SHAPE_NO_PIPE)) ?? parseOldShape(text) ?? parseLooseShape(text);
  if (!m) {
    // Chatter in the space is ignored; something that looks like a timer line but is malformed needs a human.
    return /\btim\w*\s+(on|off)\b/i.test(text) ? { kind: 'UNRECOGNIZED', messageId: msg.id, reason: 'BAD_FORMAT' } : { kind: 'IGNORED' };
  }
  const [, client, profile, status] = m;
  if (!normalizeName(client) || !normalizeName(profile)) return { kind: 'UNRECOGNIZED', messageId: msg.id, reason: 'BAD_FORMAT' };

  const tokens = status.toLowerCase().split(/[^a-z]+/).filter(Boolean)
    .filter((t) => !FILLER.includes(t) && !(t.length >= 4 && editDistance(t, 'timer') <= 1));
  const found = tokens.map(classify).filter((c) => c !== null);
  const dirs = new Set(found.map((c) => c.dir));
  if (dirs.size === 0) return { kind: 'UNRECOGNIZED', messageId: msg.id, reason: 'UNKNOWN_STATUS' };
  if (dirs.size > 1) return { kind: 'UNRECOGNIZED', messageId: msg.id, reason: 'AMBIGUOUS_STATUS' };

  const at = new Date(msg.createTime);
  if (Number.isNaN(at.getTime())) return { kind: 'UNRECOGNIZED', messageId: msg.id, reason: 'BAD_FORMAT' };
  return {
    kind: 'EVENT',
    event: {
      messageId: msg.id,
      senderId: msg.senderId,
      at,
      direction: [...dirs][0],
      client: client.trim(),
      clientKey: normalizeName(client),
      profile: profile.trim(),
      profileKey: normalizeName(profile),
      flags: found.some((c) => c.fuzzy) ? ['FUZZY_STATUS'] : [],
    },
  };
}
