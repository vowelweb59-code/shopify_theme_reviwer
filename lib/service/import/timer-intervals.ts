// Turns ON/OFF events into worked intervals. Hours are calculated: OFF timestamp minus ON timestamp.
// Anything that cannot be paired cleanly is flagged and contributes no hours.
import type { TimerEvent } from './timer-message';
import { editDistance, istDate } from './text';

export const MAX_PLAUSIBLE_MINUTES = 16 * 60;

export interface TimerInterval {
  senderId: string;
  client: string;
  profile: string;
  startAt: Date | null;
  endAt: Date | null;
  /** Null unless the interval is closed and valid. Open and orphan intervals never carry hours. */
  minutes: number | null;
  /** IST calendar date of the start (of the OFF for an orphan). */
  istDate: string;
  startMessageId: string | null;
  endMessageId: string | null;
  /** Problems that need a human. */
  flags: string[];
  /** Informational only, e.g. a client typo that was auto-corrected. Never triggers review. */
  notes: string[];
  state: 'PARSED' | 'NEEDS_REVIEW';
}

const finish = (i: Omit<TimerInterval, 'state' | 'notes'> & { notes?: string[] }): TimerInterval => ({
  ...i,
  notes: i.notes ?? [],
  state: i.flags.length ? 'NEEDS_REVIEW' : 'PARSED',
});

function closed(on: TimerEvent, off: TimerEvent, notes: string[]): TimerInterval {
  const ms = off.at.getTime() - on.at.getTime();
  const flags = [...on.flags, ...off.flags];
  let minutes: number | null = null;
  if (ms <= 0) flags.push('INVALID_DURATION');
  else {
    minutes = Math.round(ms / 60_000);
    if (minutes > MAX_PLAUSIBLE_MINUTES) flags.push('SUSPICIOUS_DURATION');
    if (istDate(on.at) !== istDate(off.at)) flags.push('CROSSES_MIDNIGHT');
  }
  return finish({
    senderId: on.senderId, client: on.client, profile: on.profile, startAt: on.at, endAt: off.at,
    minutes: ms <= 0 ? null : minutes, istDate: istDate(on.at), startMessageId: on.messageId, endMessageId: off.messageId, flags, notes,
  });
}

const open = (on: TimerEvent, extra: string[]): TimerInterval =>
  // An ON with no OFF is ALWAYS flagged, however it arose.
  finish({
    senderId: on.senderId, client: on.client, profile: on.profile, startAt: on.at, endAt: null, minutes: null,
    istDate: istDate(on.at), startMessageId: on.messageId, endMessageId: null, flags: [...on.flags, 'OPEN_INTERVAL', ...extra],
  });

const orphan = (off: TimerEvent): TimerInterval =>
  finish({
    senderId: off.senderId, client: off.client, profile: off.profile, startAt: null, endAt: off.at, minutes: null,
    istDate: istDate(off.at), startMessageId: null, endMessageId: off.messageId, flags: [...off.flags, 'ORPHAN_OFF'],
  });

/**
 * Pairs per sender + Upwork profile. An OFF closes the open ON for the same client; if the client was typed slightly
 * differently and exactly one ON is open for that profile, it pairs automatically and records CLIENT_NAME_CORRECTED.
 * Events still open when the list ends are returned as OPEN_INTERVAL (the caller decides the window; nothing is dropped).
 */
export function pairTimerEvents(events: readonly TimerEvent[]): TimerInterval[] {
  const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime() || a.messageId.localeCompare(b.messageId));
  const out: TimerInterval[] = [];
  const openByLane = new Map<string, TimerEvent[]>();

  for (const ev of sorted) {
    const lane = `${ev.senderId}\u0000${ev.profileKey}`;
    const opens = openByLane.get(lane) ?? [];
    if (ev.direction === 'ON') {
      const dup = opens.findIndex((o) => o.clientKey === ev.clientKey);
      if (dup >= 0) out.push(open(opens.splice(dup, 1)[0], ['DUPLICATE_ON']));
      opens.push(ev);
      openByLane.set(lane, opens);
      continue;
    }
    let idx = opens.findIndex((o) => o.clientKey === ev.clientKey);
    let notes: string[] = [];
    if (idx < 0) {
      const near = opens.map((o, i) => ({ i, d: editDistance(o.clientKey, ev.clientKey) })).filter((x) => x.d <= 2 && ev.clientKey.length >= 5);
      if (near.length === 1 && opens.length === 1) {
        idx = near[0].i;
        notes = ['CLIENT_NAME_CORRECTED'];
      }
    }
    if (idx < 0) out.push(orphan(ev));
    else out.push(closed(opens.splice(idx, 1)[0], ev, notes));
  }
  for (const opens of openByLane.values()) for (const on of opens) out.push(open(on, []));
  return out.sort((a, b) => (a.startAt ?? a.endAt!).getTime() - (b.startAt ?? b.endAt!).getTime());
}
