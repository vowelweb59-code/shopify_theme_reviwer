// One Chat message can be a timer line, a manual report, or both: some people post "Client | Profile - TIMER OFF"
// and then their report in the same message. Classification is by content, never by space (docs/design/data-import.md).
import { parseManualReport, type ManualEntry } from './manual-report';
import { parseTimerMessage, type TimerMessage, type TimerParse } from './timer-message';

export type MessageKind = 'TIMER' | 'MANUAL_REPORT' | 'TIMER_AND_REPORT' | 'IGNORED' | 'UNRECOGNIZED';

export interface Classified {
  kind: MessageKind;
  timer: TimerParse | null;
  reports: ManualEntry[];
}

const DECORATION = /^[\s=\-–—_*~.]*$/;
// First line looks like an attempt at a timer line: it ends in "timer on/off" or similar.
const TIMER_LINE = /\btim\w*\s+\w+\s*$/i;

export function classifyMessage(msg: TimerMessage): Classified {
  const lines = msg.text.split(/\r?\n/);
  const first = lines.findIndex((l) => !DECORATION.test(l));
  if (first < 0) return { kind: 'IGNORED', timer: null, reports: [] };

  let timer: TimerParse | null = null;
  let rest = msg.text;
  if (TIMER_LINE.test(lines[first])) {
    const parsed = parseTimerMessage({ ...msg, text: lines[first] });
    if (parsed.kind !== 'IGNORED') {
      timer = parsed;
      rest = lines.slice(first + 1).join('\n');
    }
  }
  const reports = parseManualReport(rest);
  if (timer?.kind === 'EVENT') return { kind: reports.length ? 'TIMER_AND_REPORT' : 'TIMER', timer, reports };
  if (timer) return { kind: 'UNRECOGNIZED', timer, reports };
  return { kind: reports.length ? 'MANUAL_REPORT' : 'IGNORED', timer: null, reports };
}
