import mongoose, { Schema, type InferSchemaType } from "mongoose";

// A reviewed list of pending tasks and pitch opportunities for one Chat space (owner, 2026-11-26, temporary "Space scan" tab). The space was
// read by Claude Code outside the app and the result loaded with scripts/import-space-review.ts; one document per space, `_id` = the space.
// It holds client details, so it lives in the database and never in the repository.
const itemShape = { _id: false };
const serviceSpaceReviewSchema = new Schema(
  {
    _id: { type: String, required: true },
    client: { type: String, default: null },
    // The Service project whose tab shows this space (scripts/set-space-project.ts); null = not connected to a project yet.
    projectId: { type: String, default: null, index: true },
    reviewedAt: { type: Date, required: true },
    source: { type: String, default: null },
    tasks: [
      new Schema(
        {
          group: { type: String, enum: ["client_waiting", "older", "unclear"], required: true },
          text: { type: String, required: true },
          asked: { type: String, default: null },
          who: { type: String, default: null },
          evidence: { type: String, default: null },
          threads: { type: String, default: null },
        },
        itemShape
      ),
    ],
    opportunities: [
      new Schema(
        {
          priority: { type: String, enum: ["High", "Medium", "Low"], required: true },
          title: { type: String, required: true },
          evidence: { type: String, default: null },
          pitch: { type: String, default: null },
        },
        itemShape
      ),
    ],
    notes: [{ type: String }],
  },
  { timestamps: true, collection: "service_space_reviews" }
);

export type ServiceSpaceReviewDoc = InferSchemaType<typeof serviceSpaceReviewSchema> & { _id: string };
export const ServiceSpaceReview: mongoose.Model<ServiceSpaceReviewDoc> =
  (mongoose.models.ServiceSpaceReview as mongoose.Model<ServiceSpaceReviewDoc>) ||
  mongoose.model<ServiceSpaceReviewDoc>("ServiceSpaceReview", serviceSpaceReviewSchema);
