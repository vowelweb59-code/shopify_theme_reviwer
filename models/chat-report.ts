import { Schema, model, models, type InferSchemaType } from "mongoose";

// One daily time report from the Theme Status Group space (see lib/chat/parseReport.ts):
// who posted it, which theme, how long, and a memo. `key` makes importing the
// same report twice (pasted again, or re-synced from the space) a no-op.
// A report that couldn't be matched to a team member or a theme is still
// stored, with status "needs_review" and the reason, so nothing is silently lost.
export const CHAT_REPORT_STATUSES = ["ok", "needs_review"] as const;

const chatReportSchema = new Schema(
  {
    key: { type: String, required: true },
    // Who posted it, as the space shows them; kept even when it matched a member.
    sender: { type: String, default: "", trim: true },
    memberId: { type: Schema.Types.ObjectId, ref: "TeamMember", default: null },
    date: { type: Date, required: true },
    themeName: { type: String, default: "", trim: true },
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", default: null },
    // theme: design/development work; preset: preset work; update: theme-update work, logged as hours on the theme's Theme Update project.
    kind: { type: String, enum: ["theme", "preset", "update", null], default: null },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", default: null },
    preset: { type: String, default: null },
    memo: { type: String, default: "", trim: true },
    minutes: { type: Number, required: true, min: 0 },
    status: { type: String, enum: CHAT_REPORT_STATUSES, required: true },
    reason: { type: String, default: null },
    rawText: { type: String, default: "" },
    // Classified once by scripts/classify-existing-reports.ts (the monthly development lists): re-checks leave it alone.
    locked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chatReportSchema.index({ key: 1 }, { unique: true });
chatReportSchema.index({ themeId: 1, date: -1 });
chatReportSchema.index({ memberId: 1, date: -1 });
chatReportSchema.index({ status: 1 });

export type ChatReportDoc = InferSchemaType<typeof chatReportSchema>;

export const ChatReport = models.ChatReport ?? model("ChatReport", chatReportSchema);
