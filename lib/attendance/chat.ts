import "server-only";
import { serviceChatGet, serviceChatToken } from "@/lib/service/chat/google";
import type { Mention } from "./leave";

// Reads the attendance Chat space through the Service section's Google connection (read-only; the connected account must be a
// member of the space). Unlike the TIMER STATUS reader, bot posts are kept: leave announcements may come from a leave app, and
// when a post has no plain text its card text is used.

/** The attendance space; override with ATTENDANCE_CHAT_SPACE. */
export const DEFAULT_ATTENDANCE_SPACE = "spaces/AAAA6adFMF8";
const API = "https://chat.googleapis.com/v1";
const MAX_PAGES = 100;

export function attendanceSpace(env: Record<string, string | undefined> = process.env): string {
  const s = (env.ATTENDANCE_CHAT_SPACE ?? DEFAULT_ATTENDANCE_SPACE).trim();
  return s.startsWith("spaces/") ? s : `spaces/${s}`;
}

export type RawAttendanceMessage = { externalId: string; senderName: string; senderType: string | null; postedAt: string; text: string; mentions: Mention[] };

type ChatMessage = {
  name?: string;
  createTime?: string;
  text?: string;
  formattedText?: string;
  sender?: { displayName?: string; type?: string };
  annotations?: { type?: string; startIndex?: number; length?: number; userMention?: { user?: { displayName?: string } } }[];
  cardsV2?: unknown;
};

/** Every `text` string inside a card, in order: the fallback body for a post that has none. */
function cardText(node: unknown, out: string[] = []): string[] {
  if (Array.isArray(node)) for (const n of node) cardText(n, out);
  else if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) {
      if (k === "text" && typeof v === "string") out.push(v.replace(/<[^>]*>/g, " ").trim());
      else cardText(v, out);
    }
  }
  return out;
}

/** Messages created in [from, to), oldest first. */
export async function listAttendanceMessages(refreshToken: string, space: string, { from, to }: { from: Date; to: Date }): Promise<RawAttendanceMessage[]> {
  const token = await serviceChatToken(refreshToken);
  const filter = `createTime > "${new Date(from.getTime() - 1000).toISOString()}" AND createTime < "${to.toISOString()}"`;
  const out: RawAttendanceMessage[] = [];
  let pageToken = "";
  for (let i = 0; i < MAX_PAGES; i++) {
    const params = new URLSearchParams({ pageSize: "1000", orderBy: "createTime ASC", filter, ...(pageToken ? { pageToken } : {}) });
    const r = await serviceChatGet<{ messages?: ChatMessage[]; nextPageToken?: string }>(token, `${API}/${space}/messages?${params}`);
    for (const m of r.messages ?? []) {
      if (!m.name || !m.createTime) continue;
      const plain = m.text?.trim() ? m.text : null;
      const text = plain ?? (m.formattedText?.trim() ? m.formattedText.replace(/<[^>]*>/g, " ") : cardText(m.cardsV2).join(" ").trim());
      if (!text.trim()) continue;
      // Mention positions index the plain `text`; with any other body they would point at the wrong characters.
      const mentions: Mention[] = plain
        ? (m.annotations ?? []).filter((a) => a.type === "USER_MENTION" && typeof a.length === "number").map((a) => ({ start: a.startIndex ?? 0, length: a.length!, displayName: a.userMention?.user?.displayName ?? null }))
        : [];
      out.push({ externalId: m.name, senderName: m.sender?.displayName ?? "", senderType: m.sender?.type ?? null, postedAt: m.createTime, text, mentions });
    }
    if (!r.nextPageToken) return out;
    pageToken = r.nextPageToken;
  }
  throw new Error("Chat returned too many pages; stopping");
}
