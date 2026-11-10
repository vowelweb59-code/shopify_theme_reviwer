import { Schema, model, models, type InferSchemaType } from "mongoose";
import { uuidId } from "./service-shared";

// The company's Upwork logins. `name` is the login (email or username): sensitive, never logged.
const serviceUpworkAccountSchema = new Schema(
  { _id: uuidId, name: { type: String, required: true, unique: true } },
  { timestamps: true, collection: "service_upwork_accounts" }
);

// The name a team member writes after the client in Chat ("Client | Profile"). Aliases cover spelling variants.
const serviceUpworkProfileSchema = new Schema(
  {
    _id: uuidId,
    name: { type: String, required: true, unique: true, trim: true },
    aliases: { type: [String], default: () => [] },
    accountId: { type: String, default: null, index: true },
  },
  { timestamps: true, collection: "service_upwork_profiles" }
);

// One row of the company's Upwork contract list (2019 onwards): history only; hours still come from Chat.
const serviceUpworkContractSchema = new Schema(
  {
    _id: uuidId,
    sheetRef: { type: String, required: true, unique: true },
    clientId: { type: String, default: null, index: true },
    projectId: { type: String, default: null, index: true },
    clientName: { type: String, required: true },
    profile: { type: String, default: null },
    bde: { type: String, default: null },
    ba: { type: String, default: null },
    url: { type: String, default: null },
    endedBy: { type: String, default: null },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    finalRating: { type: Number, default: null },
    changedRating: { type: Number, default: null },
    duration: { type: String, default: null },
  },
  { timestamps: true, collection: "service_upwork_contracts" }
);

export type ServiceUpworkAccountDoc = InferSchemaType<typeof serviceUpworkAccountSchema>;
export type ServiceUpworkProfileDoc = InferSchemaType<typeof serviceUpworkProfileSchema>;
export type ServiceUpworkContractDoc = InferSchemaType<typeof serviceUpworkContractSchema>;
export const ServiceUpworkAccount = models.ServiceUpworkAccount ?? model("ServiceUpworkAccount", serviceUpworkAccountSchema);
export const ServiceUpworkProfile = models.ServiceUpworkProfile ?? model("ServiceUpworkProfile", serviceUpworkProfileSchema);
export const ServiceUpworkContract = models.ServiceUpworkContract ?? model("ServiceUpworkContract", serviceUpworkContractSchema);
