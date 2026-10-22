import { Schema, model, models, type InferSchemaType } from "mongoose";

// Hours a team member spent on a Theme Update project on one day. Its own
// collection, not an array on Project: an update project is continuous, so
// its log keeps growing for as long as the theme is maintained.
//
// Entries outlive their member (deleting a member keeps the hours already
// worked), so the UI shows a missing memberId as "Removed member".
const timeEntrySchema = new Schema(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    memberId: { type: Schema.Types.ObjectId, ref: "TeamMember", required: true },
    // UTC midnight of the day the work was done (see parseDateOnly).
    date: { type: Date, required: true },
    hours: { type: Number, required: true, min: 0.01 },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

timeEntrySchema.index({ projectId: 1, date: -1 });

export type TimeEntryDoc = InferSchemaType<typeof timeEntrySchema>;

export const TimeEntry = models.TimeEntry ?? model("TimeEntry", timeEntrySchema);
