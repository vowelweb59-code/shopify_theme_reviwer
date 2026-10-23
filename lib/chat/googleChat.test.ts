import { describe, expect, it } from "vitest";
import { getChatSpace, listMemberNames, listSpaceMessages } from "./googleChat";
import { looksLikeReport } from "./syncSpace";

function fakeFetch(pages: unknown[], calls: string[] = []): typeof fetch {
  let i = 0;
  return (async (url: string) => {
    calls.push(String(url));
    return { ok: true, json: async () => pages[i++] } as Response;
  }) as unknown as typeof fetch;
}

describe("listSpaceMessages", () => {
  it("follows pages, filters by time, skips bots and empty messages, and names the sender from the member list", async () => {
    const calls: string[] = [];
    const messages = await listSpaceMessages(
      "AAA",
      "token",
      new Date("2026-10-01T00:00:00.000Z"),
      new Map([["users/2", "Pranay Nimje"]]),
      fakeFetch(
        [
          { messages: [{ name: "spaces/AAA/messages/1", text: "Date: 1-10-2026", createTime: "2026-10-02T00:00:00Z", sender: { name: "users/1", displayName: "Kunal Mendhe" } }], nextPageToken: "p2" },
          {
            messages: [
              { name: "spaces/AAA/messages/2", text: "Date: 2-10-2026", createTime: "2026-10-03T00:00:00Z", sender: { name: "users/2" } },
              { name: "spaces/AAA/messages/3", text: "hi", createTime: "2026-10-03T00:00:00Z", sender: { name: "users/9", type: "BOT" } },
              { name: "spaces/AAA/messages/4", createTime: "2026-10-03T00:00:00Z", sender: { name: "users/1" } },
            ],
          },
        ],
        calls
      )
    );
    expect(messages.map((m) => [m.id, m.senderName])).toEqual([
      ["spaces/AAA/messages/1", "Kunal Mendhe"],
      ["spaces/AAA/messages/2", "Pranay Nimje"],
    ]);
    expect(calls).toHaveLength(2);
    expect(decodeURIComponent(calls[0].replaceAll("+", " "))).toContain('createTime > "2026-10-01T00:00:00.000Z"');
    expect(calls[1]).toContain("pageToken=p2");
  });

  it("reports Google's error without echoing the response body", async () => {
    const failing = (async () => ({ ok: false, status: 403, json: async () => ({ error: { status: "PERMISSION_DENIED", message: "Chat API has not been used" } }) })) as unknown as typeof fetch;
    await expect(listSpaceMessages("AAA", "token", null, new Map(), failing)).rejects.toThrow("403 PERMISSION_DENIED: Chat API has not been used");
  });
});

describe("listMemberNames", () => {
  it("maps user ids to display names", async () => {
    const names = await listMemberNames("AAA", "token", fakeFetch([{ memberships: [{ member: { name: "users/1", displayName: "Kunal Mendhe" } }, { member: { name: "users/2" } }] }]));
    expect([...names]).toEqual([["users/1", "Kunal Mendhe"]]);
  });
});

describe("space + report detection", () => {
  it("accepts a bare id or a spaces/ name, and defaults to the Theme Status Group", () => {
    expect(getChatSpace({ GOOGLE_CHAT_SPACE: "spaces/XYZ" })).toBe("XYZ");
    expect(getChatSpace({})).toBe("AAQAo4521kg");
  });

  it("treats only messages with a Theme Name line as reports", () => {
    expect(looksLikeReport("Date: 1-1-2026\nTheme Name: A\nTimer: 1 hrs")).toBe(true);
    expect(looksLikeReport("Good morning everyone")).toBe(false);
  });
});
