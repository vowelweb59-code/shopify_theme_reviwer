// The list the matcher reads: every client under its name and each alias, all pointing at the same client id.
import type { KnownClient } from './client-match';

export function clientRegistry(clients: ReadonlyArray<{ id: string; name: string; aliases: readonly string[] }>): KnownClient[] {
  return clients.flatMap((c) => [{ id: c.id, name: c.name }, ...c.aliases.map((a) => ({ id: c.id, name: a }))]);
}
