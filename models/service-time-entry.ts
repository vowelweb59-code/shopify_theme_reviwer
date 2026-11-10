import { Schema, model, models, type InferSchemaType } from "mongoose";
import { SERVICE_ENTRY_STATES, uuidId } from "./service-shared";

// Hours reported in TIMER STATUS, owned by the Chat sender. TIMER_CALCULATED = OFF minus ON; MANUAL_REPORT = as written.
// Reported hours, not Upwork-verified billable hours. Weekly figures are computed from these rows, never stored.
// `projectId` is set when a person (or the auto-assign rules) placed the entry; otherwise its client's only live project
// owns it (lib/service/hours/attribution.ts). `allocations` share one entry's minutes across several projects (they add
// up to `minutes`); such an entry has no projectId.
const allocationSchema = new Schema({ projectId: { type: String, required: true }, minutes: { type: Number, required: true } }, { _id: false });

const serviceTimeEntrySchema = new Schema(
  {
    _id: uuidId,
    userId: { type: String, default: null },
    // Copied from the source message, so per-person totals need no join.
    senderExternalId: { type: String, required: true },
    profile: { type: String, default: null }, // as written in Chat
    clientRaw: { type: String, default: null }, // the client field as written, kept so it can be matched later
    profileId: { type: String, default: null, index: true },
    ordinal: { type: Number, default: 0 },
    clientId: { type: String, default: null },
    projectId: { type: String, default: null },
    allocations: { type: [allocationSchema], default: () => [] },
    entryDate: { type: Date, required: true }, // IST day, as UTC midnight
    minutes: { type: Number, required: true },
    source: { type: String, enum: ["TIMER_CALCULATED", "MANUAL_REPORT"], required: true },
    state: { type: String, enum: SERVICE_ENTRY_STATES, default: "PARSED" },
    flags: { type: [String], default: () => [] },
    notes: { type: [String], default: () => [] },
    memo: { type: String, default: null },
    reportedOnTimerMinutes: { type: Number, default: null },
    reconciliation: { type: String, default: null },
    isLate: { type: Boolean, default: false },
    parserVersion: { type: String, required: true },
    startMessageId: { type: String, default: null },
    sourceMessageId: { type: String, required: true },
  },
  { timestamps: true, collection: "service_time_entries" }
);
// Idempotent import: one entry per source message, source and position.
serviceTimeEntrySchema.index({ sourceMessageId: 1, source: 1, ordinal: 1 }, { unique: true });
serviceTimeEntrySchema.index({ entryDate: 1 });
serviceTimeEntrySchema.index({ clientId: 1, entryDate: 1 });
serviceTimeEntrySchema.index({ projectId: 1, entryDate: 1 });
serviceTimeEntrySchema.index({ "allocations.projectId": 1 });
serviceTimeEntrySchema.index({ senderExternalId: 1, entryDate: 1 });
serviceTimeEntrySchema.index({ state: 1 });

export type ServiceTimeEntryDoc = InferSchemaType<typeof serviceTimeEntrySchema>;
export const ServiceTimeEntry = models.ServiceTimeEntry ?? model("ServiceTimeEntry", serviceTimeEntrySchema);
