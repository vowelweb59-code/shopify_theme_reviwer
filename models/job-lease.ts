import { Schema, model, models } from "mongoose";

// One row per running background job (key = the job, e.g. "service-sync:2026-11"), so a manual run and a scheduled run, or two
// server instances during a deploy overlap, can't work on the same thing at once. Expired rows are taken over; a TTL index
// tidies old ones.
const jobLeaseSchema = new Schema(
  {
    _id: { type: String, required: true },
    holder: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { collection: "job_leases", versionKey: false }
);
jobLeaseSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 3600 });

export const JobLease = models.JobLease ?? model("JobLease", jobLeaseSchema);
