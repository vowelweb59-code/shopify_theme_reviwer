import { Schema, model, models, type InferSchemaType } from "mongoose";
import { uuidId } from "./service-shared";

// A manager or staff member of the service team (Huzefa, Husain, ...). Not a login: the app has one shared session.
// Kept because project managers decide a project's department, and Chat senders can be linked to a person here.
const serviceUserSchema = new Schema(
  {
    _id: uuidId,
    email: { type: String, default: null, lowercase: true, trim: true },
    displayName: { type: String, required: true, trim: true },
    kind: { type: String, enum: ["MANAGEMENT", "EMPLOYEE"], default: "MANAGEMENT" },
    active: { type: Boolean, default: true },
  },
  { timestamps: true, collection: "service_users" }
);

export type ServiceUserDoc = InferSchemaType<typeof serviceUserSchema>;
export const ServiceUser = models.ServiceUser ?? model("ServiceUser", serviceUserSchema);
