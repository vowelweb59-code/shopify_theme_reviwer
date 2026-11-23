// The two public legal pages (owner, 2026-11-23): Google needs a privacy policy and terms link on the OAuth consent screen before the app
// can be published. They are the ONLY pages reachable without signing in besides /login (see `isPublicPath` in proxy.ts) and render
// without the app's sidebar. Keep their text accurate: it describes what the app really does with Google data.

/** Paths served without a session and without the app shell. */
export const PUBLIC_LEGAL_PATHS = ["/privacy", "/terms"] as const;

export const isPublicLegalPath = (pathname: string): boolean => (PUBLIC_LEGAL_PATHS as readonly string[]).includes(pathname);

export const LEGAL_OPERATOR = "Vowel Web";
export const LEGAL_CONTACT = "support@vowelweb.com";
export const LEGAL_APP_NAME = "Upwork Ops Platform";
export const LEGAL_UPDATED = "23 November 2026";
