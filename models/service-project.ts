import { Schema, model, models, type InferSchemaType } from "mongoose";
import { SERVICE_PERSON_ROLES, SERVICE_PROJECT_STATUSES, uuidId } from "./service-shared";

// BAs, BDs and executives: team members kept by name (often Chat senders), linked to the sender when one matches.
const personSchema = new Schema(
  {
    role: { type: String, enum: SERVICE_PERSON_ROLES, required: true },
    name: { type: String, required: true, trim: true },
    senderId: { type: String, default: null },
  },
  { _id: false }
);

// A manager (decides the department) or staff member from the ServiceUser directory.
const assignmentSchema = new Schema(
  { userId: { type: String, required: true }, role: { type: String, enum: ["MANAGER", "EMPLOYEE"], required: true } },
  { _id: false }
);

const historySchema = new Schema(
  {
    fromStatus: { type: String, enum: [...SERVICE_PROJECT_STATUSES, null], default: null },
    toStatus: { type: String, enum: SERVICE_PROJECT_STATUSES, required: true },
    reason: { type: String, default: null },
    at: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

// One contract per project (owner decision), so it lives on the project and time entries point at the project.
// Weekly limit is entered by hand (no Upwork connection). Money is US dollars in cents.
const contractSchema = new Schema(
  {
    externalRef: { type: String, default: null },
    type: { type: String, enum: ["HOURLY", "FIXED"], default: "HOURLY" },
    weeklyLimitMinutes: { type: Number, default: null },
    hourlyRateCents: { type: Number, default: null },
    fixedPriceCents: { type: Number, default: null },
    trackingMode: { type: String, enum: ["TIMER", "MANUAL", null], default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    status: { type: String, enum: ["ACTIVE", "PAUSED", "ENDED"], default: "ACTIVE" },
  },
  { _id: false }
);

const serviceProjectSchema = new Schema(
  {
    _id: uuidId,
    name: { type: String, required: true, trim: true },
    clientId: { type: String, default: null, index: true },
    upworkAccountId: { type: String, default: null },
    upworkProfileId: { type: String, default: null },
    // Words that, written in the Chat client field, put an entry on this project (for a client with several projects).
    chatKeywords: { type: [String], default: () => [] },
    // Own products or support: hours show as in-house, never against a limit.
    inHouse: { type: Boolean, default: false },
    reviewRating: { type: Number, default: null },
    reviewComment: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    contractRef: { type: String, default: null },
    description: { type: String, default: null },
    projectType: { type: String, default: null },
    status: { type: String, enum: SERVICE_PROJECT_STATUSES, default: "NOT_STARTED", index: true },
    startDate: { type: Date, default: null },
    targetDate: { type: Date, default: null },
    revisedDate: { type: Date, default: null },
    people: { type: [personSchema], default: () => [] },
    assignments: { type: [assignmentSchema], default: () => [] },
    history: { type: [historySchema], default: () => [] },
    // null = no contract yet: the client's hours then count toward no project.
    contract: { type: contractSchema, default: null },
  },
  { timestamps: true, collection: "service_projects" }
);

export type ServiceProjectDoc = InferSchemaType<typeof serviceProjectSchema>;
export const ServiceProject = models.ServiceProject ?? model("ServiceProject", serviceProjectSchema);
