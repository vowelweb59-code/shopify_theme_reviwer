// "Moved to another department" (owner, 2026-11-20, manual placement 2026-11-21): the one rule the Service overview and the Live Project Chat
// Summary tabs share, so both list the same Active projects. Only an ACTIVE or ON_HOLD project can be placed there; STAY keeps it with the
// team, MOVED always moves it, and otherwise it moves when someone reported on it since the cutoff but nobody from the Digital Marketing
// team did. Days are IST "YYYY-MM-DD" strings; an empty string means no report.
export interface PlacementInput {
  status: string;
  deptOverride?: "STAY" | "MOVED" | null;
}

export function isMovedToOtherDept(p: PlacementInput, lastAnyDay: string, lastDmDay: string, movedCutoff: string): boolean {
  if (p.status !== "ACTIVE" && p.status !== "ON_HOLD") return false;
  if (p.deptOverride === "STAY") return false;
  if (p.deptOverride === "MOVED") return true;
  return lastAnyDay >= movedCutoff && lastDmDay < movedCutoff;
}
