import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/analytics/crypto";
import { loginToStorefront, type StorefrontSession } from "@/lib/audit/storefrontPassword";
import type { PresetLink } from "@/lib/audit/liveChecks/shared";
import { Theme } from "@/models/theme";

// Passwords of password-protected demo stores, saved per theme and per store host (the demo store's own password, a low-value secret,
// but still kept encrypted and never sent back to the browser: the UI only learns which hosts have one).

type Stored = { host: string; password: string };

export function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Hosts that have a saved password for this theme (never the passwords). */
export async function savedPasswordHosts(themeId: unknown): Promise<string[]> {
  const theme = await Theme.findById(themeId).select("+demoStorePasswords").lean<{ demoStorePasswords?: Stored[] }>();
  return (theme?.demoStorePasswords ?? []).map((p) => p.host);
}

/** Saves (replaces) the password for a host, after checking the store accepts it. Returns an error message, or null when saved. */
export async function savePassword(themeId: unknown, storeUrl: string, password: string): Promise<string | null> {
  const host = hostOf(storeUrl);
  if (!host) return "That is not a valid store URL.";
  if (!password) return "Enter the store's password.";
  const login = await loginToStorefront(storeUrl, password);
  if (!login.ok) return login.error;
  if (login.session === null) return "This store is not password-protected, so there is nothing to save.";
  const encrypted = encryptSecret(password);
  await Theme.updateOne({ _id: themeId }, { $pull: { demoStorePasswords: { host } } });
  await Theme.updateOne({ _id: themeId }, { $push: { demoStorePasswords: { host, password: encrypted } } });
  return null;
}

export async function removePassword(themeId: unknown, host: string): Promise<void> {
  await Theme.updateOne({ _id: themeId }, { $pull: { demoStorePasswords: { host } } });
}

/**
 * For an audit: logs in to every preset's store that has a saved password and returns the presets with their session cookie
 * (in memory only, never stored on the audit run). A store whose saved password no longer works gets a `passwordNote` instead,
 * which the live checks show as that preset's error. Presets of stores without a saved password are returned unchanged.
 */
export async function attachStorefrontSessions(themeId: unknown, presets: PresetLink[]): Promise<PresetLink[]> {
  let stored: Stored[] = [];
  try {
    stored = (await Theme.findById(themeId).select("+demoStorePasswords").lean<{ demoStorePasswords?: Stored[] }>())?.demoStorePasswords ?? [];
  } catch {
    return presets;
  }
  if (stored.length === 0) return presets;
  const byHost = new Map<string, { session?: StorefrontSession | null; note?: string }>();
  for (const preset of presets) {
    const host = hostOf(preset.url);
    const saved = host ? stored.find((p) => p.host === host) : undefined;
    if (!host || !saved || byHost.has(host)) continue;
    let plain: string;
    try {
      plain = decryptSecret(saved.password);
    } catch {
      byHost.set(host, { note: "The saved password for this store can't be read (the encryption key changed). Save it again." });
      continue;
    }
    const login = await loginToStorefront(preset.url, plain);
    byHost.set(host, login.ok ? { session: login.session } : { note: `The saved password was not accepted: ${login.error}` });
  }
  return presets.map((p) => {
    const found = byHost.get(hostOf(p.url) ?? "");
    if (!found) return p;
    return { ...p, ...(found.session ? { session: found.session } : {}), ...(found.note ? { passwordNote: found.note } : {}) };
  });
}
