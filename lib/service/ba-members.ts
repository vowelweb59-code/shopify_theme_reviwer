// Business analysts of the company (owner, 2026-11-16). Others who left earlier are not listed; a post naming one is read as no BA.
// Matched on the first name written ("Mohit" = "Mohit Panpalia").
export const BA_MEMBERS = [
  { name: "Mohammed Taher", first: "mohammed", left: false },
  { name: "Mohit", first: "mohit", left: false },
  { name: "Harsha", first: "harsha", left: false },
  { name: "Trupti", first: "trupti", left: false },
  { name: "Sourabh", first: "sourabh", left: true },
] as const;

/**
 * A BA name as it should be shown (owner, 2026-11-21: "Harsha Gongle and Harsha are the same"): a BA of the company is shown by the name in
 * the list above whatever way it was written. Anyone else is shown as written.
 */
export function canonicalBa(written: string): string {
  return baMatch(written)?.name ?? written;
}

export const uniqueBa = (names: readonly string[]) => [...new Set(names.map(canonicalBa))];

/** The BA a written name stands for, or null. */
export function baMatch(written: string | null | undefined): (typeof BA_MEMBERS)[number] | null {
  const first = (written ?? "").trim().split(/\s+/)[0]?.toLowerCase();
  return first ? BA_MEMBERS.find((b) => b.first === first) ?? null : null;
}
