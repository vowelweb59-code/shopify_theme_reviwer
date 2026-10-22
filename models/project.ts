import { Schema, model, models, type InferSchemaType } from "mongoose";
import { PORTALS, PROJECT_STATUSES, PROJECT_TYPES } from "@/lib/projects/constants";

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
    // Which portal (Theme Store account) it belongs to; null until set.
    portal: { type: String, enum: [...PORTALS, null], default: null },
    // Rows from before project types existed have no `type`; they are all
    // Theme Design & Development (lib/projects/constants.ts), which the API
    // fills in when reading. Immutable after creation so a project's data
    // (status vs. logged hours) never disagrees with its type.
    type: { type: String, enum: PROJECT_TYPES, required: true, default: "theme_development", immutable: true },
    // null for a Theme Update project, which has no status.
    status: { type: String, enum: [...PROJECT_STATUSES, null], default: null },
    // How long the design and the development phases took, in days. Entered
    // by hand for now (themes built before this existed); null = not known.
    designDays: { type: Number, default: null, min: 0 },
    developmentDays: { type: Number, default: null, min: 0 },
    members: { type: [projectMemberSchema], default: () => [] },
  },
  { timestamps: true }
);

projectSchema.index({ themeId: 1, createdAt: -1 });
projectSchema.index({ "members.memberId": 1 });

export type ProjectDoc = InferSchemaType<typeof projectSchema>;

export const Project = models.Project ?? model("Project", projectSchema);
