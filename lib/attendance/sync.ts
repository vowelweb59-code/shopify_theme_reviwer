import "server-only";
import { connectToDatabase } from "@/lib/db/connect";
import { istMonth, istMonthWindow } from "@/lib/service/chat/months";
import { serviceRefreshToken } from "@/lib/service/chat/sync";
import { AttendanceMessage, AttendanceSync } from "@/models/attendance";
import { attendanceSpace, listAttendanceMessages } from "./chat";

// Reads the attendance space (the last few months, so a leave posted late or an edited post is picked up) and stores the posts
// as received. Safe to repeat: a post is keyed by its Chat message id and an edit replaces its text.

export const DEFAULT_SYNC_MONTHS = 3;

export async function syncAttendance(months = DEFAULT_SYNC_MONTHS) {
  const back = Math.min(Math.max(Math.floor(months), 1), 24);
  const space = attendanceSpace();
  await connectToDatabase();
  const from = istMonthWindow(istMonth(new Date(), back - 1)).from;
  const to = new Date(Date.now() + 24 * 60 * 60 * 1000);
  try {
    const messages = await listAttendanceMessages(await serviceRefreshToken(), space, { from, to });
    if (messages.length > 0) {
      await AttendanceMessage.bulkWrite(
        messages.map((m) => ({
          updateOne: {
            filter: { spaceId: space, externalId: m.externalId },
            update: { $set: { senderName: m.senderName, senderType: m.senderType, postedAt: new Date(m.postedAt), text: m.text, mentions: m.mentions } },
            upsert: true,
          },
        })) as never
      );
    }
    await AttendanceSync.updateOne({ key: "attendance" }, { $set: { lastSyncAt: new Date(), lastCount: messages.length, lastWindowFrom: from, lastError: null } }, { upsert: true });
    return { fetched: messages.length, from, space };
  } catch (err) {
    await AttendanceSync.updateOne({ key: "attendance" }, { $set: { lastError: err instanceof Error ? err.message : String(err) } }, { upsert: true });
    throw err;
  }
}
