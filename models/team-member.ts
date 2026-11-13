import { Schema, model, models, type InferSchemaType } from "mongoose";

// A person on the team, with the designation they hold (Developer, QA, ...).
// Not a login — the app has one shared session (lib/auth/session.ts) — so
// this is a directory used to staff projects, nothing more. `designation` is
// free text; lib/projects/constants.ts only supplies suggestions.
const teamMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, default: null, lowercase: true, trim: true },
    designation: { type: String, required: true, trim: true },
    // Never works on a new theme: their time reports (lib/chat/resolve.ts) are preset work or theme updates.
    updatesAndPresetsOnly: { type: Boolean, default: false },
    // Monthly salary in INR, used only to cost the hours a person reports on each theme (lib/projects/cost.ts). Null = not entered:
    // that person's hours are counted but not costed.
    monthlySalary: { type: Number, default: null, min: 0 },
    // How the person is paid (owner, 2026-11-13): "salary" (monthlySalary prices their reported hours), or "per_live": a fixed amount
    // for each Theme Design & Development project (perLiveTheme) and each Preset project (perLivePreset) that goes Live and that they
    // are on (assigned or reported). A per-live person's hours are not priced by the hour.
    payModel: { type: String, enum: ["salary", "per_live"], default: "salary" },
    perLiveTheme: { type: Number, default: null, min: 0 },
    perLivePreset: { type: Number, default: null, min: 0 },
    // Left the team (owner, 2026-11-13: kept instead of deleted so their project and round history stays). Hidden on the Team page
    // and out of the project pickers, Current Work and automatic project assignment; their past reports and rounds still name them.
    inactive: { type: Boolean, default: false },
    // Other spellings of the name that show up as the poster in Google Chat ("Aaqib Iqbal" for "Aaquib Iqbal").
    aliases: { type: [String], default: () => [] },
  },
  { timestamps: true }
);

// Partial so any number of members can omit the email.
teamMemberSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
teamMemberSchema.index({ name: 1 });

// Mongo has no `on delete cascade`: take a removed member off every project.
teamMemberSchema.pre("findOneAndDelete", async function () {
  const doc = await this.model.findOne(this.getFilter()).select("_id");
  if (!doc) return;
  const { Project } = await import("./project");
  await Project.updateMany({ "members.memberId": doc._id }, { $pull: { members: { memberId: doc._id } } });
  await Project.updateMany({ "rounds.members.memberId": doc._id }, { $pull: { "rounds.$[].members": { memberId: doc._id } } });
});

export type TeamMemberDoc = InferSchemaType<typeof teamMemberSchema>;

export const TeamMember = models.TeamMember ?? model("TeamMember", teamMemberSchema);
