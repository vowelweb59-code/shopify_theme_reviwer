// The month plan end to end, without a database: classification, pairing, client matching, reconciliation, duplicates.
import { describe, expect, it } from "vitest";
import { extractClient } from "./client-field";
import { planImport, type RawChatMessage, type SpaceInput } from "./plan";

const clients = ["Acme Co", "Beta Ltd", "Gamma Inc", "Stacy King", "Brian Denton", "Hi Beauty"].map((name, i) => ({ id: `c${i}`, name }));
const id = (name: string) => clients.find((c) => c.name === name)!.id;

let n = 0;
/** IST wall time "YYYY-MM-DDTHH:mm" to a Chat createTime in UTC. */
const at = (wall: string) => new Date(new Date(`${wall}:00Z`).getTime() - 330 * 60_000).toISOString();
const m = (sender: string, wall: string, text: string): RawChatMessage => ({
  externalId: `msg${++n}`,
  senderExternalId: sender,
  senderName: `Person ${sender}`,
  postedAt: at(wall),
  text,
});
const master = (...messages: RawChatMessage[]): SpaceInput => ({ externalId: "spaces/master", name: "Timer Status", type: "TIMER_STATUS", messages });
const plan = (...spaces: SpaceInput[]) => planImport({ month: "2026-10", spaces, clients });

describe("client field", () => {
  it.each([
    ["Acme Co | Sam", "Acme Co", "Sam"],
    ["R | Acme Co | Sam", "Acme Co", "Sam"],
    ["App | Acme Co | Sam", "Acme Co", "Sam"],
    ["Stacy King (Matthew Gerson)- Adnan", "Stacy King", "Adnan"],
    ["Brian Denton, Bridge Strategies | Rahul", "Brian Denton", "Rahul"],
    ["Acme Co - Taha", "Acme Co", "Taha"],
    ["Acme Co l Harsha", "Acme Co", "Harsha"],
    ["Acme Co | Sam | No Timer", "Acme Co", "Sam"],
    ["Acme Co", "Acme Co", null],
    ["HI BEAUTY | Batul", "Hi Beauty", "Batul"],
  ])("%s", (raw, client, profile) => {
    const f = extractClient(raw, clients);
    expect(f.match.status === "EXACT" && f.match.client.name).toBe(client);
    expect(f.profile).toBe(profile);
  });

  it("corrects a typo and leaves an unknown client unmatched", () => {
    expect(extractClient("Gama Inc | Sam", clients).match.status).toBe("CORRECTED");
    expect(extractClient("Nobody Special | Sam", clients)).toMatchObject({ match: { status: "UNKNOWN" }, profile: "Sam" });
  });
});

describe("month plan", () => {
  it("counts a report as its OFF hours plus its ON figure, and the TIMER ON / OFF messages count nothing (owner 2026-11-21)", () => {
    const p = plan(
      master(
        m("s1", "2026-10-23T10:00", "Acme Co | Sam - TIMER ON"),
        m("s1", "2026-10-23T13:00", "Acme Co | Sam - TIMER OFF"),
        m("s1", "2026-10-23T19:00", "Daily Report – 23/10/2026\nClient: Acme Co | Sam\nON Timer: 03:00 hrs\nOFF Timer: 01:00 hrs\nMemo: Work.")
      )
    );
    expect(p.entries).toHaveLength(1);
    expect(p.entries[0]).toMatchObject({
      source: "MANUAL_REPORT",
      minutes: 240,
      reportedOnTimerMinutes: 180,
      clientId: id("Acme Co"),
      state: "PARSED",
      entryDate: "2026-10-23",
      senderExternalId: "s1",
    });
    expect(p.entries[0]!.notes).toContain("ON_TIMER_COUNTED");
  });

  it("counts the report's ON figure when it differs from the timer messages, lower or higher (Rupali, 16 Nov: report 2:30, timer 3:21)", () => {
    const day = (sender: string, onHours: string, off: string) =>
      plan(
        master(
          m(sender, "2026-10-23T10:00", "Beta Ltd | Rahul - TIMER ON"),
          m(sender, `2026-10-23T${off}`, "Beta Ltd | Rahul - TIMER OFF"),
          m(sender, "2026-10-23T19:00", `Daily Report – 23/10/2026\nClient: Beta Ltd | Rahul\nON Timer: ${onHours} hrs\nMemo: x`)
        )
      ).entries;
    expect(day("s2", "02:30", "13:21").map((e) => e.minutes)).toEqual([150]); // timer longer than the report
    expect(day("s11", "04:00", "11:00").map((e) => e.minutes)).toEqual([240]); // timer shorter than the report
  });

  it("timer messages count as a fallback when the person wrote no report for that client that day", () => {
    const p = plan(master(m("s7", "2026-10-23T10:00", "Acme Co | Sam - TIMER ON"), m("s7", "2026-10-23T13:00", "Acme Co | Sam - TIMER OFF")));
    expect(p.entries.map((e) => [e.source, e.minutes, e.state, e.clientId, e.entryDate, e.notes])).toEqual([
      ["TIMER_CALCULATED", 180, "PARSED", id("Acme Co"), "2026-10-23", ["TIMER_FALLBACK"]],
    ]);
  });

  it("the fallback skips an open timer, an OFF with no ON, and a timer left running over 8h30", () => {
    const p = plan(
      master(
        m("s7", "2026-10-23T09:00", "Acme Co | Sam - TIMER ON"), // open: never stopped
        m("s8", "2026-10-23T10:00", "Beta Ltd | Rahul - TIMER OFF"), // no ON
        m("s5", "2026-10-23T08:00", "Gamma Inc | Ali - TIMER ON"),
        m("s5", "2026-10-23T18:00", "Gamma Inc | Ali - TIMER OFF") // 10 h
      )
    );
    expect(p.entries).toHaveLength(0);
  });

  it("the fallback does not count on a day the same person wrote a report for that client", () => {
    const p = plan(
      master(
        m("s6", "2026-10-23T10:00", "Acme Co | Sam - TIMER ON"),
        m("s6", "2026-10-23T13:00", "Acme Co | Sam - TIMER OFF"),
        m("s6", "2026-10-23T19:00", ["Daily Report – 23/10/2026", "Client: Acme Co | Sam", "OFF Timer: 01:00 hrs", "Memo: Work."].join("\n")),
        // another day, no report: counts
        m("s6", "2026-10-24T10:00", "Acme Co | Sam - TIMER ON"),
        m("s6", "2026-10-24T11:30", "Acme Co | Sam - TIMER OFF")
      )
    );
    expect(p.entries.map((e) => [e.source, e.entryDate, e.minutes])).toEqual([
      ["MANUAL_REPORT", "2026-10-23", 60],
      ["TIMER_CALCULATED", "2026-10-24", 90],
    ]);
  });

  it("a report with only OFF hours counts them, whatever the timer messages of the day say", () => {
    const p = plan(
      master(
        m("s9", "2026-10-23T10:00", "Acme Co | Sam - TIMER ON"),
        m("s9", "2026-10-23T11:00", "Acme Co | Sam - TIMER OFF"),
        m("s9", "2026-10-23T19:00", ["Daily Report – 23/10/2026", "Client: Acme Co | Sam", "OFF Timer: 04:00 hrs", "Memo: Work."].join("\n"))
      )
    );
    expect(p.entries.map((e) => [e.source, e.minutes, e.state])).toEqual([["MANUAL_REPORT", 240, "PARSED"]]);
  });

  it("an ON figure counts as reported, with or without timer messages behind it; an open timer counts nothing", () => {
    const p = plan(
      master(
        m("s3", "2026-10-23T09:00", "Gamma Inc | Ali - TIMER ON"),
        m("s4", "2026-10-23T19:00", "Daily Report – 23/10/2026\nClient: Beta Ltd | Rahul\nON Timer: 02:00 hrs\nMemo: x")
      )
    );
    expect(p.entries.find((e) => e.senderExternalId === "s3")).toBeUndefined();
    expect(p.entries.find((e) => e.senderExternalId === "s4")).toMatchObject({
      minutes: 120,
      state: "PARSED",
      notes: expect.arrayContaining(["ON_TIMER_COUNTED"]),
    });
  });

  it("counts a report posted in both the master and the client space once", () => {
    const text = "Daily Report – 23/10/2026\nClient: Acme Co | Sam\nOFF Timer: 02:00 hrs\nMemo: x";
    const p = plan(master(m("s1", "2026-10-23T19:00", text)), {
      externalId: "spaces/acme",
      name: "Acme",
      type: "CLIENT_PROJECT",
      clientId: id("Acme Co"),
      messages: [m("s1", "2026-10-23T19:01", text)],
    });
    const manual = p.entries.filter((e) => e.source === "MANUAL_REPORT");
    expect(manual.map((e) => e.state).sort()).toEqual(["PARSED", "REJECTED"]);
    expect(manual.find((e) => e.state === "REJECTED")!.notes).toContain("DUPLICATE_POST");
  });

  it("auto-corrects a client typo without sending it to review; unknown clients go to review", () => {
    const p = plan(
      master(
        m("s4", "2026-10-23T19:00", "Daily Report – 23/10/2026\nClient: Gama Inc | Ali\nOFF Timer: 07.00 hrs\nMemo: x"),
        m("s4", "2026-10-23T19:01", "Daily Report – 23/10/2026\nClient: Someone New | Ali\nOFF Timer: 01:00 hrs\nMemo: y")
      )
    );
    const [typo, unknown] = p.entries;
    expect(typo).toMatchObject({ clientId: id("Gamma Inc"), minutes: 420, state: "PARSED", notes: ["CLIENT_NAME_CORRECTED"] });
    expect(unknown).toMatchObject({ clientId: null, state: "NEEDS_REVIEW", flags: ["UNKNOWN_CLIENT"] });
  });

  it("marks a report posted after Monday 17:30 IST as late, and ignores other months", () => {
    const p = plan(
      master(
        m("s1", "2026-10-27T10:00", "Daily Report – 23/10/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x"),
        m("s1", "2026-10-26T17:00", "Daily Report – 22/10/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x"),
        m("s1", "2026-11-02T10:00", "Daily Report – 02/11/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x")
      )
    );
    expect(p.entries.map((e) => [e.entryDate, e.isLate])).toEqual([
      ["2026-10-22", false],
      ["2026-10-23", true],
    ]);
    expect(p.summary.messages).toBe(2);
  });

  it("flags a date a few days from the posting day; several different reports for one client and day all count", () => {
    const p = plan(
      master(
        m("s1", "2026-10-23T19:00", "Daily Report – 23/09/2026\nClient: Acme Co | Sam\nOFF Timer: 01:00 hrs\nMemo: x"),
        m(
          "s2",
          "2026-10-23T19:00",
          "Daily Report – 23/10/2026\nClient: Beta Ltd | Sam\nOFF Timer: 01:30 hr\nMemo: a\n\nClient: Beta Ltd | Sam\nOFF Timer: 01:00 hr\nMemo: b"
        )
      )
    );
    expect(p.entries.find((e) => e.senderExternalId === "s1")!.flags).toContain("DATE_FAR_FROM_POST");
    const s2 = p.entries.filter((e) => e.senderExternalId === "s2");
    expect(s2).toHaveLength(2);
    expect(s2.every((e) => e.state === "PARSED" && !e.flags.includes("MULTIPLE_REPORTS_SAME_DAY") && e.notes.includes("MULTIPLE_REPORTS_SAME_DAY"))).toBe(true); // a note, not a question
  });

  it("a resent report with the same memo and other hours replaces the earlier one", () => {
    const body = (hours: string) =>
      `Daily Report – 23/10/2026\nClient: Acme Co | Sam\nOFF Timer: ${hours} hrs\nMemo: Updated the product pages and fixed the cart bug`;
    const p = plan(master(m("s3", "2026-10-23T18:00", body("01:00")), m("s3", "2026-10-23T19:00", body("02:00"))));
    const [first, second] = p.entries.filter((e) => e.senderExternalId === "s3");
    expect(first).toMatchObject({ minutes: 60, state: "REJECTED" });
    expect(first!.notes).toContain("SUPERSEDED_BY_RESEND");
    expect(second).toMatchObject({ minutes: 120, state: "PARSED" });
  });

  it("a timer line and its report in one message give one manual entry from the report", () => {
    const p = plan(
      master(
        m("s1", "2026-10-23T09:00", "Acme Co | Sam - TIMER ON"),
        m("s1", "2026-10-23T17:00", "Acme Co | Sam - TIMER OFF\n\nDate:- 23-10-2026\nClient Name:- App | Acme Co | Sam\nOn timer:- 08:00 hrs\nMemo: x")
      )
    );
    expect(p.summary.byKind).toMatchObject({ TIMER: 1, TIMER_AND_REPORT: 1 });
    expect(p.entries.map((e) => [e.source, e.minutes])).toEqual([["MANUAL_REPORT", 480]]);
  });

  it("is deterministic: planning the same messages twice gives the same plan", () => {
    const msgs = [m("s1", "2026-10-23T10:00", "Acme Co | Sam - TIMER ON"), m("s1", "2026-10-23T11:00", "Acme Co | Sam - TIMER OFF")];
    expect(plan(master(...msgs))).toEqual(plan(master(...msgs)));
  });
});
