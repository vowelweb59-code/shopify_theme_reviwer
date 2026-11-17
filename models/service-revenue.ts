import mongoose, { Schema, type InferSchemaType } from "mongoose";
import { uuidId } from "./service-shared";

// Money actually taken from clients, one row per client and month, imported from the owner's sales sheet ("SEO SALES - HUZEFA.xlsx",
// column TOTAL AMT; owner, 2026-11-17) by scripts/import-revenue-sheet.ts. The Revenue tab compares it with what the reported hours
// were worth. Amounts are US dollars in cents; a refund or adjustment is negative. Not tied to a project: the sheet only has names.
const serviceRevenueTakenSchema = new Schema(
  {
    _id: uuidId,
    month: { type: String, required: true, index: true }, // YYYY-MM
    clientName: { type: String, required: true },
    section: { type: String, default: null }, // the BA heading the row sat under in the sheet
    profile: { type: String, default: null },
    bde: { type: String, default: null },
    amountCents: { type: Number, required: true },
  },
  { timestamps: true, collection: "service_revenue_taken" }
);

export type ServiceRevenueTakenDoc = InferSchemaType<typeof serviceRevenueTakenSchema> & { _id: string };
export const ServiceRevenueTaken: mongoose.Model<ServiceRevenueTakenDoc> =
  (mongoose.models.ServiceRevenueTaken as mongoose.Model<ServiceRevenueTakenDoc>) || mongoose.model<ServiceRevenueTakenDoc>("ServiceRevenueTaken", serviceRevenueTakenSchema);
