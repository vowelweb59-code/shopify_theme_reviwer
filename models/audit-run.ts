import { Schema, model, models, type InferSchemaType } from "mongoose";

export const AUDIT_RUN_STATUSES = ["pending", "running", "complete", "failed"] as const;

const auditRunSummarySchema = new Schema(
  {
    total: { type: Number, required: true, default: 0 },
    blocker: { type: Number, required: true, default: 0 },
    high: { type: Number, required: true, default: 0 },
    medium: { type: Number, required: true, default: 0 },
    low: { type: Number, required: true, default: 0 },
    byCategory: { type: Map, of: Number, default: undefined },
  },
  { _id: false }
);

const auditRunSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, required: true, ref: "Theme", index: true },
    status: { type: String, required: true, enum: AUDIT_RUN_STATUSES, default: "pending" },
    startedAt: { type: Date, required: true, default: () => new Date() },
    completedAt: { type: Date, default: null },
    error: { type: String, default: null },
    summary: { type: auditRunSummarySchema, default: undefined },
  },
  { timestamps: false }
);

async function cascadeDeleteFindings(auditRunId: unknown) {
  if (!auditRunId) return;
  const { Finding } = await import("./finding");
  await Finding.deleteMany({ auditRunId });
}

auditRunSchema.pre("findOneAndDelete", async function () {
  const doc = await this.model.findOne(this.getFilter()).select("_id");
  if (doc) await cascadeDeleteFindings(doc._id);
});

auditRunSchema.pre("deleteOne", { document: true, query: false }, async function () {
  await cascadeDeleteFindings(this._id);
});

export type AuditRunDoc = InferSchemaType<typeof auditRunSchema>;

export const AuditRun = models.AuditRun ?? model("AuditRun", auditRunSchema);
