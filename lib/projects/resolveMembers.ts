type Ref = { memberId: unknown; role: string | null };
type Person = { _id: unknown; name: string; designation: string };

/** Member refs -> { memberId, name, designation, role }; a member deleted since is dropped. */
export function resolveMembers(refs: Ref[], byId: Map<string, Person>) {
  return refs.flatMap((ref) => {
    const m = byId.get(String(ref.memberId));
    return m ? [{ memberId: String(m._id), name: m.name, designation: m.designation, role: ref.role }] : [];
  });
}

/** A project's earlier rounds with each round's team resolved. */
export function resolveRounds(rounds: { status: string; rejectionStage?: string | null; designDays: number | null; developmentDays: number | null; note: string; members: Ref[] }[] | undefined, byId: Map<string, Person>) {
  return (rounds ?? []).map((r) => ({ status: r.status, rejectionStage: r.rejectionStage ?? null, designDays: r.designDays ?? null, developmentDays: r.developmentDays ?? null, note: r.note ?? "", members: resolveMembers(r.members ?? [], byId) }));
}
