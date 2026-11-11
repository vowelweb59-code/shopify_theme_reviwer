import { Schema, model, models } from "mongoose";

// A plain record of destructive actions on the theme side (deleting a project, a team member, a theme's sales, disconnecting
// Ads). With one shared login there is no "who", so it records what, which record, and when. The Service section keeps its own
// hash-chained log (service_audit_log); the two are deliberately separate.
const adminAuditSchema = new Schema(
  {
    action: { type: String, required: true },
    detail: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "admin_audit_log" }
);
adminAuditSchema.index({ createdAt: -1 });

export const AdminAudit = models.AdminAudit ?? model("AdminAudit", adminAuditSchema);
