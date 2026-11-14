import { describe, expect, it } from "vitest";
import { supersededReports, type StoredForMessage } from "./superseded";

const message = { id: "spaces/s/messages/m1", sender: "Musaddique Afsar", postedAt: "2026-11-13T13:41:52.123Z", keys: new Set(["new-key"]) };
const old = (over: Partial<StoredForMessage>): StoredForMessage => ({ _id: "a", key: "old-key", messageId: null, sender: "Musaddique Afsar", postedAt: new Date("2026-11-13T13:41:52.123Z"), ...over });

describe("supersededReports", () => {
  it("replaces a report of the same message whose text is no longer there", () => {
    expect(supersededReports([old({ messageId: message.id })], message)).toHaveLength(1);
  });

  it("finds a report stored before message ids were kept by poster and posting time", () => {
    expect(supersededReports([old({})], message)).toHaveLength(1);
    expect(supersededReports([old({ sender: "Someone Else" })], message)).toHaveLength(0);
    expect(supersededReports([old({ postedAt: new Date("2026-11-13T13:41:53.000Z") })], message)).toHaveLength(0);
    expect(supersededReports([old({ postedAt: null })], message)).toHaveLength(0);
  });

  it("keeps a report the message still makes, one from another message, and one classified by hand", () => {
    expect(supersededReports([old({ key: "new-key" })], message)).toHaveLength(0);
    expect(supersededReports([old({ messageId: "spaces/s/messages/other" })], message)).toHaveLength(0);
    expect(supersededReports([old({ locked: true })], message)).toHaveLength(0);
  });
});
