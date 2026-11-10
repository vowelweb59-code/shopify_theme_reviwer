import { Schema, model, models, type InferSchemaType } from "mongoose";
import { uuidId } from "./service-shared";

// A client of the service team, as named in the TIMER STATUS Chat space.
const serviceClientSchema = new Schema(
  {
    _id: uuidId,
    name: { type: String, required: true, trim: true },
    // Other spellings seen in Chat; they resolve to this client.
    aliases: { type: [String], default: () => [] },
    // Work for ourselves (own products), not a paying client: no contract, shown apart on the dashboard.
    inHouse: { type: Boolean, default: false },
    // Several projects: an entry naming no project is shared equally across the projects with hours in the 14 days before it.
    splitUnclear: { type: Boolean, default: false },
  },
  { timestamps: true, collection: "service_clients" }
);
serviceClientSchema.index({ name: 1 });

export type ServiceClientDoc = InferSchemaType<typeof serviceClientSchema>;
export const ServiceClient = models.ServiceClient ?? model("ServiceClient", serviceClientSchema);
