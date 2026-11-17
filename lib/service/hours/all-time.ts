import { memo } from "@/lib/cache/memo";
import { ServiceTimeEntry } from "@/models/service-time-entry";

export interface AllTimeEntry {
  projectId: string | null;
  clientId: string | null;
  minutes: number;
  allocations: Array<{ projectId: string; minutes: number }>;
  senderExternalId: string;
  entryDate: Date;
}

/**
 * Every counted entry ever (not rejected, minutes above zero): the overview's all-time hours and the Revenue tab both add these up, and
 * it is the biggest read on the Service side (about 14,000 rows). Cached for 20 s and shared by the two pages; a write or an import
 * calls `forgetMemo("service:")`. Callers must not change the rows.
 */
export const loadAllTimeEntries = () =>
  memo("service:all-time-entries", 20_000, () =>
    ServiceTimeEntry.find({ state: { $ne: "REJECTED" }, minutes: { $gt: 0 } })
      .select("projectId clientId minutes allocations senderExternalId entryDate")
      .lean<AllTimeEntry[]>()
  );
