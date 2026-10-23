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
