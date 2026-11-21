// Business developers of the company (owner, 2026-11-16: Ashfaque, Mohit, Ali Asger Bagichawala, Pranit, Ali Asger Ezzi "and a few
// more", taken from the live projects, which carry the old app's data: Manasvi, Preeti, Kaustubh). The old data writes the two Ali
// Asgers as "Aliasger B" (Bagichawala) and plain "Aliasger" (Ezzi, the more frequent one: assumed, check). A post naming anyone else
// is read as no BD.
export const BD_MEMBERS = [
  { name: "Ashfaque", spellings: ["ashfaque"] },
  { name: "Mohit", spellings: ["mohit", "mohit panpalia"] },
  { name: "Ali Asger Bagichawala", spellings: ["ali asger bagichawala", "aliasger b", "ali asger b", "aliasger bagichawala"] },
  { name: "Ali Asger Ezzi", spellings: ["ali asger ezzi", "aliasger ezzi", "aliasger", "ali asger"] },
  { name: "Pranit", spellings: ["pranit"] },
  { name: "Manasvi", spellings: ["manasvi"] },
  { name: "Preeti", spellings: ["preeti"] },
  { name: "Kaustubh", spellings: ["kaustubh"] },
] as const;

const norm = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();

/**
 * A BD name as it should be shown (owner, 2026-11-21: "Aliasger B and Aliasger Bagichawala are same"): the spellings of Ali Asger Bagichawala all show
 * as one name. Every other name is shown as written (plain "Aliasger" stays as written: it is only assumed to be Ezzi).
 */
export function canonicalBd(written: string): string {
  const m = bdMatch(written);
  return m && m.name === "Ali Asger Bagichawala" ? m.name : written;
}

/** Names in a list shown as one each: the same person written two ways appears once. */
export const uniqueBd = (names: readonly string[]) => [...new Set(names.map(canonicalBd))];

/** The BD a written name stands for, or null. */
export function bdMatch(written: string | null | undefined): (typeof BD_MEMBERS)[number] | null {
  const w = norm(written ?? "");
  return w ? (BD_MEMBERS.find((b) => (b.spellings as readonly string[]).includes(w)) ?? null) : null;
}
