import { Schema, model, models, type InferSchemaType } from "mongoose";

// One row of an imported Shopify Partner theme-sales sheet (Sales page).
// Each upload belongs to one theme; the preset a store uses is worked out
// separately per shop domain (models/sales-store.ts), so a correction there
// re-labels every sale from that store at once.
const saleRecordSchema = new Schema(
  {
    themeId: { type: Schema.Types.ObjectId, ref: "Theme", required: true },
    soldAt: { type: Date, required: true },
    /** "YYYY-MM" in UTC — the grouping key for monthly tables. */
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    shopName: { type: String, default: "" },
    /** Lowercase host, e.g. "abc123.myshopify.com". */
    shopDomain: { type: String, required: true, lowercase: true, trim: true },
    country: { type: String, default: "" },
    /** "sale" | "refund" | anything else the sheet says, lowercased. */
    chargeType: { type: String, required: true },
    amount: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },
    share: { type: Number, default: 0 },
    /** The sheet's own preset columns, kept as a fallback when the live store can't tell us. */
    sheetPreset: { type: String, default: "" },
    sheetPresetAlt: { type: String, default: "" },
    /** Re-uploading the same sheet adds only rows not seen before (the user's choice). */
    dedupeKey: { type: String, required: true },
  },
  { timestamps: true }
);

saleRecordSchema.index({ dedupeKey: 1 }, { unique: true });
saleRecordSchema.index({ themeId: 1, month: 1 });
saleRecordSchema.index({ shopDomain: 1 });

export type SaleRecordDoc = InferSchemaType<typeof saleRecordSchema>;

export const SaleRecord = models.SaleRecord ?? model("SaleRecord", saleRecordSchema);
