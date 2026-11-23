// Pure parser tests for the two time-report streams (docs/design/data-import.md). No database.
import { describe, expect, it } from "vitest";
import { parseManualReport } from "./manual-report";
import { parseTimerMessage, type TimerEvent } from "./timer-message";
import { normalizeName, parseDayMonthYear, parseDuration } from "./text";

let n = 0;
/** createTime is UTC; pass IST wall time as "YYYY-MM-DDTHH:mm" and it is converted. */
const ist = (wall: string) => new Date(new Date(`${wall}:00Z`).getTime() - 330 * 60_000).toISOString();
const msg = (text: string, wall: string, senderId = "noaman") => ({ id: `m${++n}`, senderId, createTime: ist(wall), text });
const ev = (text: string, wall: string, senderId?: string): TimerEvent => {
  const r = parseTimerMessage(msg(text, wall, senderId));
  if (r.kind !== "EVENT") throw new Error(`not an event: ${text} -> ${r.kind}`);
  return r.event;
};

describe("timer message parsing", () => {
  it("reads timer lines with the pipe before the status, glued dashes and look-alike pipes", () => {
    expect(ev("Abe Rubarts | Mohammad | TIMER OFF", "2026-10-28T11:00")).toMatchObject({ direction: "OFF", client: "Abe Rubarts", profile: "Mohammad" });
    expect(ev("Nishan Singh | Shraddha TIMER ON", "2026-10-28T11:00")).toMatchObject({ direction: "ON", client: "Nishan Singh", profile: "Shraddha" });
    expect(ev("Zabiullah Yousufi | Aliasger B-Timer ON", "2026-10-28T11:00")).toMatchObject({
      direction: "ON",
      client: "Zabiullah Yousufi",
      profile: "Aliasger B",
    });
    expect(ev("Adam Lando | Zainab- timer off", "2026-10-28T11:00")).toMatchObject({ direction: "OFF", client: "Adam Lando", profile: "Zainab" });
    expect(ev("Arman Ambar I Mohammed I Timer OFF", "2026-10-28T11:00")).toMatchObject({ direction: "OFF", client: "Arman Ambar", profile: "Mohammed" });
    // no separator between the names: still a human's call
    expect(parseTimerMessage(msg("Louise Wilkinson Taha Timer ON", "2026-10-28T11:00")).kind).toBe("UNRECOGNIZED");
  });
  it("reads a doubled letter in the status", () => {
    expect(ev("Yuri Parreno | Rahul - TIMER ONN", "2026-10-31T07:33")).toMatchObject({ direction: "ON", flags: ["FUZZY_STATUS"] });
  });
  it("reads a dash that touches the profile", () => {
    expect(ev("Paul Vandeyar | Ali Asger  B- TIMER ON", "2026-10-28T11:56")).toMatchObject({
      direction: "ON",
      client: "Paul Vandeyar",
      profile: "Ali Asger  B",
    });
  });
  it("reads the 2023 wording with the profile in brackets", () => {
    expect(ev("Client: Sebastian Kramer- (Priti)- Timer ON", "2023-06-01T10:00")).toMatchObject({
      direction: "ON",
      client: "Sebastian Kramer",
      profile: "Priti",
    });
    expect(ev("Client: Matthew Stibbe - (Hamza) timer ON", "2023-06-01T10:00")).toMatchObject({ direction: "ON", client: "Matthew Stibbe", profile: "Hamza" });
    expect(ev("Client: (Viktoriya Hopperstad ) -Priti: Timer OFF", "2023-06-01T10:00")).toMatchObject({
      direction: "OFF",
      client: "Viktoriya Hopperstad",
      profile: "Priti",
    });
    expect(ev("Hans Gerritsen:(Zainab Raja): TIMER ON", "2023-06-01T10:00")).toMatchObject({
      direction: "ON",
      client: "Hans Gerritsen",
      profile: "Zainab Raja",
    });
    expect(ev("Client: Jen Olea (Zainab) - Timer OFF", "2023-06-01T10:00")).toMatchObject({ direction: "OFF", client: "Jen Olea", profile: "Zainab" });
    // chatter that merely mentions a timer is still not an event
    expect(parseTimerMessage(msg("please keep the timer on today", "2023-06-01T10:00")).kind).not.toBe("EVENT");
  });

  it("parses the real format: client | Upwork profile - TIMER ON", () => {
    const r = parseTimerMessage(msg("Dan Staggs | Mohammed - TIMER ON", "2026-10-26T09:40"));
    expect(r.kind).toBe("EVENT");
    if (r.kind !== "EVENT") return;
    expect(r.event).toMatchObject({ direction: "ON", client: "Dan Staggs", profile: "Mohammed", senderId: "noaman", flags: [] });
    expect(r.event.at.toISOString()).toBe("2026-10-26T04:10:00.000Z");
  });

  it("accepts the other dash styles and keeps hyphenated profile names whole", () => {
    expect(ev("Thani Almheiri | Sapana - TIMER OFF", "2026-10-24T10:00").direction).toBe("OFF");
    expect(ev("Thani Almheiri | Sapana – TIMER OFF", "2026-10-24T10:00").profile).toBe("Sapana");
    expect(ev("Acme | Mo-Hammed - TIMER ON", "2026-10-24T10:00").profile).toBe("Mo-Hammed");
  });

  it("understands other verbs and flags one-letter typos instead of trusting them silently", () => {
    expect(ev("A | B - Timer started", "2026-10-24T10:00").direction).toBe("ON");
    expect(ev("A | B - TIMER STOPPED", "2026-10-24T10:00").direction).toBe("OFF");
    const typo = ev("A | B - TIMER STOPED", "2026-10-24T10:00");
    expect(typo.direction).toBe("OFF");
    expect(typo.flags).toContain("FUZZY_STATUS");
    expect(ev("A | B - TIMR ON", "2026-10-24T10:00").direction).toBe("ON");
  });

  it("never guesses: short or unknown words are reported, not mapped", () => {
    const unknown = parseTimerMessage(msg("A | B - TIMER OF", "2026-10-24T10:00"));
    expect(unknown).toMatchObject({ kind: "UNRECOGNIZED", reason: "UNKNOWN_STATUS" });
    expect(parseTimerMessage(msg("A | B - TIMER WIBBLE", "2026-10-24T10:00"))).toMatchObject({ reason: "UNKNOWN_STATUS" });
    expect(parseTimerMessage(msg("A | B - timer on then off", "2026-10-24T10:00"))).toMatchObject({ reason: "AMBIGUOUS_STATUS" });
  });

  it("ignores chatter but surfaces a malformed timer line", () => {
    expect(parseTimerMessage(msg("lunch break, back at 2", "2026-10-24T10:00")).kind).toBe("IGNORED");
    expect(parseTimerMessage(msg("Dan Staggs Mohammed TIMER ON", "2026-10-24T10:00"))).toMatchObject({ kind: "UNRECOGNIZED", reason: "BAD_FORMAT" });
  });
});

describe("manual daily report (OFF Timer)", () => {
  const sample =
    "Daily Report – 24/10/2026\nClient –Patrick O'Donnell\nOFF Timer – 08:30 hrs\nMemo – Deployed the app on the new droplet and tested the live app.";

  it("parses the real sample", () => {
    const [e] = parseManualReport(sample);
    expect(e).toMatchObject({ date: "2026-10-24", client: "Patrick O'Donnell", minutes: 510, state: "PARSED", flags: [] });
    expect(e.memo).toBe("Deployed the app on the new droplet and tested the live app.");
  });

  it("tolerates separators, casing and a multi-client message under one date", () => {
    const es = parseManualReport("daily report - 24/10/2026\nClient: A\nOff timer: 2:00 hrs\nMemo: x\nClient - B\nOFF Timer - 03:15 hrs\nMemo - y");
    expect(es.map((e) => [e.client, e.date, e.minutes])).toEqual([
      ["A", "2026-10-24", 120],
      ["B", "2026-10-24", 195],
    ]);
  });

  it("keeps wrapped memo lines", () => {
    const [e] = parseManualReport(`${sample}\nand fixed DNS afterwards`);
    expect(e.memo).toContain("live app.\nand fixed DNS afterwards");
  });

  it("counts only OFF Timer from the report; an ON Timer figure is recorded but never counted", () => {
    const [e] = parseManualReport("Daily Report – 24/10/2026\nClient – A\nON Timer – 03:00 hrs\nOFF Timer – 02:00 hrs");
    expect(e.minutes).toBe(120);
    expect(e.reportedOnTimerMinutes).toBe(180);
    const [onlyOn] = parseManualReport("Daily Report – 24/10/2026\nClient – A\nON Timer – 03:00 hrs");
    expect(onlyOn.minutes).toBeNull();
    expect(onlyOn.state).toBe("PARSED");
  });

  it("sends missing or bad fields to review instead of guessing", () => {
    const [bad] = parseManualReport("Client – A\nOFF Timer – 8.30 hrs");
    expect(bad.flags).toEqual(expect.arrayContaining(["MISSING_DATE"]));
    expect(bad.minutes).toBe(510); // 8.30 is HH.MM
    expect(bad.state).toBe("NEEDS_REVIEW");
    const [none] = parseManualReport("Daily Report – 31/02/2026\nClient – A\nMemo – x");
    expect(none.flags).toEqual(expect.arrayContaining(["INVALID_DATE", "MISSING_DURATION"]));
    const [long] = parseManualReport("Daily Report – 24/10/2026\nClient – A\nOFF Timer – 20:00 hrs");
    expect(long.flags).toContain("SUSPICIOUS_DURATION");
  });
});

describe("text helpers", () => {
  it("normalizes names", () => expect(normalizeName("  Patrick  O'Donnell ")).toBe("patrick o donnell"));
  it("parses durations and dates", () => {
    expect(parseDuration("08:30 hrs").minutes).toBe(510);
    expect(parseDuration("7.5 hrs").minutes).toBe(450);
    expect(parseDuration("99:99").flag).toBe("INVALID_DURATION");
    expect(parseDayMonthYear("24/10/2026")).toBe("2026-10-24");
    expect(parseDayMonthYear("31/02/2026")).toBeNull();
  });
});
