import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";

// SSRF guard for URLs a user typed in (preset / demo-store URLs the live
// checks fetch). Without it, a signed-in user — or anyone holding a stolen
// session — could point the server at localhost, the Render private
// network or a cloud metadata address, and read back status codes and
// error text through the audit's live-check errors.
//
// Known limit: the address is checked at lookup time, and fetch() resolves
// the name again when it connects, so a DNS server answering differently
// the second time (DNS rebinding) isn't stopped. Closing that needs a
// connection pinned to the checked IP.

export class BlockedUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedUrlError";
  }
}

const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10], // carrier-grade NAT
  ["127.0.0.0", 8],
  ["169.254.0.0", 16], // link-local, incl. 169.254.169.254 metadata
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4], // multicast
  ["240.0.0.0", 4], // reserved + broadcast
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["ff00::", 8], // multicast
  ["64:ff9b::", 96], // NAT64 onto IPv4 — could reach any v4 address
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

export function isBlockedAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return blocked.check(ip, "ipv4");
  if (family === 6) {
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(ip);
    if (mapped) return blocked.check(mapped[1], "ipv4");
    return blocked.check(ip, "ipv6");
  }
  return true; // not an IP at all: refuse rather than guess
}

type Lookup = (hostname: string) => Promise<{ address: string }[]>;
const defaultLookup: Lookup = (hostname) => lookup(hostname, { all: true, verbatim: true });

/** Throws BlockedUrlError unless `raw` is an http(s) URL whose host resolves only to public addresses. */
export async function assertPublicUrl(raw: string, resolve: Lookup = defaultLookup): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new BlockedUrlError(`Not a valid URL: ${raw}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new BlockedUrlError("Only http and https URLs can be checked.");
  if (url.username || url.password) throw new BlockedUrlError("URLs with a username or password can't be checked.");

  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new BlockedUrlError(`${url.hostname} is a private address and can't be checked.`);
  }
  const addresses = isIP(host) ? [{ address: host }] : await resolve(host).catch(() => []);
  if (addresses.length === 0) throw new BlockedUrlError(`Couldn't resolve ${url.hostname}.`);
  if (addresses.some((a) => isBlockedAddress(a.address))) {
    throw new BlockedUrlError(`${url.hostname} points to a private address and can't be checked.`);
  }
  return url;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

export type PublicFetchOptions = {
  timeoutMs: number;
  /** Stop reading the body after this many bytes (default 5 MB). */
  maxBytes?: number;
  maxRedirects?: number;
  resolve?: Lookup;
};

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  if (!res.body) return res.text(); // test doubles and bodiless responses
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error(`Response is larger than ${Math.round(maxBytes / 1024 / 1024)} MB.`);
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * GET a user-supplied URL as text: every hop (including each redirect) is
 * checked with assertPublicUrl, redirects are capped, and the body is cut
 * off at maxBytes so an endless response can't exhaust memory.
 */
export async function fetchPublicText(raw: string, options: PublicFetchOptions): Promise<string> {
  const { timeoutMs, maxBytes = 5 * 1024 * 1024, maxRedirects = 5, resolve } = options;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let current = raw;
    for (let hop = 0; ; hop++) {
      const url = await assertPublicUrl(current, resolve);
      const res = await fetch(url, { signal: controller.signal, redirect: "manual" });
      if (REDIRECT_STATUSES.has(res.status)) {
        const location = res.headers?.get("location");
        if (!location) throw new Error(`Request failed with status ${res.status}`);
        if (hop >= maxRedirects) throw new Error("Too many redirects.");
        current = new URL(location, url).toString();
        continue;
      }
      if (!res.ok) throw new Error(`Request failed with status ${res.status}`);
      return await readCapped(res, maxBytes);
    }
  } finally {
    clearTimeout(timeout);
  }
}
