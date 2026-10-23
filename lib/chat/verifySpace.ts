import "server-only";
import { ChatConnection } from "@/models/chat-connection";
import { ChatReport } from "@/models/chat-report";
import { getChatSpace, listSpaceMessages } from "./googleChat";
import { parseReport, splitReports } from "./parseReport";
import { chatAccessToken, looksLikeReport } from "./syncSpace";

export type VerifyResult = {
  messagesInSpace: number;
  firstMessage: string | null;
  lastMessage: string | null;
  /** Messages with a Theme Name line, and the reports they hold (a message can hold several). */
  reportMessages: number;
  reportsInSpace: number;
  otherMessages: number;
  storedReports: number;
  /** In the space but not stored, with the reason when the text can't be imported. */
  missing: { date: string; who: string; reason: string; text: string }[];
  /** Stored from a paste, or no longer in the space (edited or deleted there). */
  storedNotInSpace: number;
  /** A sample of the messages that are not time reports, so a differently written report is easy to spot. */
  otherSamples: { date: string; who: string; text: string }[];
};

const norm = (t: string) => t.replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Read-only: compares every message in the Theme Status Group with the stored reports and says what, if anything, was not
 * imported. Writes nothing (apart from refreshing the access token, like any sync).
 */
export async function verifySpace(): Promise<VerifyResult> {
  const connection = await ChatConnection.findOne({ key: "chat" }).select("+encryptedAccessToken +encryptedRefreshToken");
  if (!connection || connection.status !== "active") throw new Error("Google Chat isn't connected. Connect it first.");
  const accessToken = await chatAccessToken(connection);

  const messages = await listSpaceMessages(getChatSpace(), accessToken, null, new Map());
  const reportMessages = messages.filter((m) => looksLikeReport(m.text));
  const others = messages.filter((m) => !looksLikeReport(m.text));

  const inSpace = reportMessages.flatMap((m) => splitReports(m.text).map((text) => ({ text, who: m.senderName || m.senderId, date: m.createTime.slice(0, 10) })));
  const stored = await ChatReport.find().select("rawText key").lean();
  const storedTexts = new Set(stored.map((r) => norm(r.rawText)));
  const spaceTexts = new Set(inSpace.map((r) => norm(r.text)));

  const missing = inSpace
    .filter((r) => !storedTexts.has(norm(r.text)))
    .map((r) => {
      const parsed = parseReport(r.text);
      return { date: r.date, who: r.who, reason: parsed.ok ? "Readable, but not stored yet" : `Can't be imported: ${parsed.error}`, text: r.text.replace(/\s+/g, " ").slice(0, 200) };
    });

  return {
    messagesInSpace: messages.length,
    firstMessage: messages[0]?.createTime.slice(0, 10) ?? null,
    lastMessage: messages.at(-1)?.createTime.slice(0, 10) ?? null,
    reportMessages: reportMessages.length,
    reportsInSpace: inSpace.length,
    otherMessages: others.length,
    storedReports: stored.length,
    missing,
    // Split children (key "...#Preset") share their original's text and are not extra.
    storedNotInSpace: stored.filter((r) => !r.key.includes("#") && !spaceTexts.has(norm(r.rawText))).length,
    otherSamples: others.slice(0, 15).map((m) => ({ date: m.createTime.slice(0, 10), who: m.senderName || m.senderId, text: m.text.replace(/\s+/g, " ").slice(0, 140) })),
  };
}
