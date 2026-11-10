import { Schema, model, models, type InferSchemaType } from "mongoose";

// The attendance Chat space as received: only leave announcements are posted there. Parsed when read (lib/attendance/leave.ts),
// so a parser fix needs no re-import. Separate from the service and theme teams' collections.
const mentionSchema = new Schema({ start: Number, length: Number, displayName: { type: String, default: null } }, { _id: false });

const attendanceMessageSchema = new Schema(
  {
    spaceId: { type: String, required: true },
    externalId: { type: String, required: true },
    senderName: { type: String, default: "" },
    /** HUMAN or BOT: the announcements may come from a leave app. */
    senderType: { type: String, default: null },
    postedAt: { type: Date, required: true, index: true },
    text: { type: String, required: true },
    /** @mentions with their position in `text` (the first is the team lead). */
    mentions: { type: [mentionSchema], default: () => [] },
  },
  { timestamps: true, collection: "attendance_messages" }
);
attendanceMessageSchema.index({ spaceId: 1, externalId: 1 }, { unique: true });

export type AttendanceMessageDoc = InferSchemaType<typeof attendanceMessageSchema>;
export const AttendanceMessage = models.AttendanceMessage ?? model("AttendanceMessage", attendanceMessageSchema);

// Singleton: when the space was last read and how it went.
const attendanceSyncSchema = new Schema(
  {
    key: { type: String, required: true, default: "attendance", unique: true },
    lastSyncAt: { type: Date, default: null },
    lastCount: { type: Number, default: 0 },
    lastWindowFrom: { type: Date, default: null },
    lastError: { type: String, default: null },
  },
  { timestamps: true, collection: "attendance_sync" }
);

export const AttendanceSync = models.AttendanceSync ?? model("AttendanceSync", attendanceSyncSchema);
