import { Schema, model, models, type InferSchemaType } from "mongoose";

// Append-only, hash-chained record of changes made in the Service section (lib/service/audit/record.ts).
const serviceAuditLogSchema = new Schema(
  {
    seq: { type: Number, required: true, unique: true },
    // The signed-in user, for rows migrated from the old app (it had per-user logins); null since (one shared session).
    actorId: { type: String, default: null },
    action: { type: String, required: true },
    detail: { type: Schema.Types.Mixed, default: () => ({}) },
    at: { type: Date, required: true },
    prevHash: { type: String, required: true },
    hash: { type: String, required: true },
  },
  { collection: "service_audit_log" }
);

export type ServiceAuditLogDoc = InferSchemaType<typeof serviceAuditLogSchema>;
export const ServiceAuditLog = models.ServiceAuditLog ?? model("ServiceAuditLog", serviceAuditLogSchema);
