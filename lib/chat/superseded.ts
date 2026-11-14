// A Chat message that was edited after it was imported (owner, 2026-11-14: Musaddique's "Fashion Theme" report became "Catalyst | Clothing |
// SAMS") has new text, so the import sees new reports; the reports made from the old text must go, or the old and new would both stay.
// The reports of one message are found by the message's id, or, for reports stored before ids were kept, by the same poster and the
// same posting time.

export type StoredForMessage = { _id: unknown; key: string; messageId?: string | null; sender: string; postedAt?: Date | null; locked?: boolean };
export type MessageRead = { id: string; sender: string; postedAt?: string; /** The keys of every report the message's current text makes. */ keys: Set<string> };

/** The stored reports of this message that its current text no longer makes. Reports classified by hand (locked) are never replaced. */
export function supersededReports(existing: StoredForMessage[], message: MessageRead): StoredForMessage[] {
  const at = message.postedAt ? new Date(message.postedAt).getTime() : null;
  return existing.filter((r) => {
    if (r.locked || message.keys.has(r.key)) return false;
    if (r.messageId) return r.messageId === message.id;
    return at !== null && r.postedAt != null && new Date(r.postedAt).getTime() === at && r.sender === message.sender;
  });
}
