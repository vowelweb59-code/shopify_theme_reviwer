import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PROJECT_STATUSES } from "@/lib/projects/constants";

// Work on one theme (a new build, a version update, a fix round). A theme can
// have several projects over time, so themeId is indexed but not unique.
// `role` is what the member does on *this* project and defaults, in the UI,
// to their designation; it's kept per assignment since the same person can
// lead one project and just review another.
const projectMemberSchema = new Schema(
  {
    memberId: { type: Schema.Types.ObjectId, ref: "TeamMember", required: true },
    role: { type: String, default: null, trim: true },
  },
  { _id: false }
);

const projectSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "", trim: true },
    status: { type: String, enum: PROJECT_STATUSES, required: true, default: "planning" },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    members: { type: [projectMemberSchema], default: () => [] },
  },
  { timestamps: true }
);

projectSchema.index({ themeId: 1, createdAt: -1 });
projectSchema.index({ "members.memberId": 1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

export const Project = models.Project ?? model("Project", projectSchema);
