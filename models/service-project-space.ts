import mongoose, { Schema, type InferSchemaType } from "mongoose";

// Which Chat space belongs to which Service project, for the Live Project Chat Summary tabs (owner, 2026-11-26). One document per space
// (`_id` = "spaces/XXXX"); a project can have several. Set by scripts/set-space-project.ts and scripts/link-matched-spaces.ts. It exists
// before any reviewed list does, so a tab can be connected first and filled later (ServiceSpaceReview, keyed by the same space).
const serviceProjectSpaceSchema = new Schema(
  {
    _id: { type: String, required: true },
    projectId: { type: String, required: true, index: true },
    displayName: { type: String, default: null }, // the space's name in Chat, for reading the tab
  },
  { timestamps: true, collection: "service_project_spaces" }
);

export type ServiceProjectSpaceDoc = InferSchemaType<typeof serviceProjectSpaceSchema> & { _id: string };
export const ServiceProjectSpace: mongoose.Model<ServiceProjectSpaceDoc> =
  (mongoose.models.ServiceProjectSpace as mongoose.Model<ServiceProjectSpaceDoc>) ||
  mongoose.model<ServiceProjectSpaceDoc>("ServiceProjectSpace", serviceProjectSpaceSchema);
