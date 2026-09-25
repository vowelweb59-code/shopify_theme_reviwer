import "server-only";
import type { Auth } from "googleapis";
import { GoogleConnection } from "@/models/google-connection";
import { decryptSecret, encryptSecret } from "./crypto";
import { Ga4OAuthError, classifyRefreshError, createGa4OAuthClient, type Ga4OAuthResult } from "./googleOAuth";

// Stored GA4 Google accounts: save after OAuth, list, validate, disconnect,
// and hand out authorized clients (Phase 3+ will call getAuthorizedClient).
// Callers must have run connectToDatabase() first.

const TOKEN_FIELDS = "+encryptedAccessToken +encryptedRefreshToken";

/** What API routes may return: everything except tokens. */
export type PublicGoogleConnection = {
  id: string;
  email: string;
  displayName: string | null;
  status: string;
  scopes: string[];
  connectedAt: string | null;
  lastValidatedAt: string | null;
  lastRefreshedAt: string | null;
  disconnectedAt: string | null;
  lastError: string | null;
};

type ConnectionLike = {
  _id: { toString(): string };
  email: string;
  displayName?: string | null;
  status: string;
  scopes?: string[];
  connectedAt?: Date | null;
  lastValidatedAt?: Date | null;
  lastRefreshedAt?: Date | null;
  disconnectedAt?: Date | null;
  lastError?: string | null;
};

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString() : null);

// Built field by field (never by spreading the document), so a token that
// was explicitly selected can't leak into a response by accident.
export function toPublicConnection(doc: ConnectionLike): PublicGoogleConnection {
  return {
    id: doc._id.toString(),
    email: doc.email,
    displayName: doc.displayName ?? null,
    status: doc.status,
    scopes: doc.scopes ?? [],
    connectedAt: iso(doc.connectedAt),
    lastValidatedAt: iso(doc.lastValidatedAt),
    lastRefreshedAt: iso(doc.lastRefreshedAt),
    disconnectedAt: iso(doc.disconnectedAt),
    lastError: doc.lastError ?? null,
  };
}

export async function listConnections(): Promise<PublicGoogleConnection[]> {
  const docs = await GoogleConnection.find().sort({ createdAt: 1 }).lean<ConnectionLike[]>();
  return docs.map(toPublicConnection);
}

/**
 * Upserts by Google account id: connecting account B never touches account
 * A's row, and reconnecting A updates A's row in place.
 */
export async function saveConnectionFromOAuth(result: Ga4OAuthResult): Promise<{ connection: PublicGoogleConnection; isReconnect: boolean }> {
  const existing = await GoogleConnection.findOne({ googleAccountId: result.googleAccountId }).select(TOKEN_FIELDS);

  // With prompt=consent Google should always return a refresh token, but if
  // it ever doesn't, an existing (still valid) one is kept rather than lost.
  const encryptedRefreshToken = result.refreshToken ? encryptSecret(result.refreshToken) : existing?.encryptedRefreshToken;
  if (!encryptedRefreshToken) {
    throw new Ga4OAuthError(
      "missing_refresh_token",
      "Google didn't issue offline access. Remove this app at myaccount.google.com/permissions, then connect again."
    );
  }

  const now = new Date();
  const doc = await GoogleConnection.findOneAndUpdate(
    { googleAccountId: result.googleAccountId },
    {
      $set: {
        email: result.email,
        displayName: result.displayName,
        status: "active",
        encryptedAccessToken: encryptSecret(result.accessToken),
        encryptedRefreshToken,
        tokenExpiresAt: result.expiryDate,
        scopes: result.scopes,
        connectedAt: now,
        lastValidatedAt: now,
        disconnectedAt: null,
        lastError: null,
      },
    },
    { upsert: true, returnDocument: "after", runValidators: true }
  );

  return { connection: toPublicConnection(doc), isReconnect: Boolean(existing) };
}

async function loadWithTokens(connectionId: string) {
  return GoogleConnection.findById(connectionId).select(TOKEN_FIELDS);
}

/** Google rejected the refresh token: drop the dead tokens so only a reconnect helps. */
export async function markConnectionRevoked(connectionId: string): Promise<void> {
  await GoogleConnection.updateOne(
    { _id: connectionId },
    {
      $set: {
        status: "revoked",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        lastValidatedAt: new Date(),
        lastError: "Google revoked access (or the token expired). Reconnect this account.",
      },
    }
  );
}

/** Records a refresh failure. Transient failures leave status alone. */
async function recordRefreshFailure(connectionId: string, err: unknown): Promise<"revoked" | "config" | "transient"> {
  const kind = classifyRefreshError(err);
  const now = new Date();
  if (kind === "revoked") {
    await markConnectionRevoked(connectionId);
  } else if (kind === "config") {
    await GoogleConnection.updateOne(
      { _id: connectionId },
      { $set: { status: "error", lastValidatedAt: now, lastError: "This app's Google OAuth client was rejected — check GOOGLE_CLIENT_ID/SECRET." } }
    );
  } else {
    await GoogleConnection.updateOne({ _id: connectionId }, { $set: { lastError: "Couldn't reach Google to refresh access. Try again shortly." } });
  }
  return kind;
}

function persistRefreshedTokens(connectionId: string, client: Auth.OAuth2Client) {
  client.on("tokens", (tokens) => {
    if (!tokens.access_token) return;
    void GoogleConnection.updateOne(
      { _id: connectionId },
      {
        $set: {
          encryptedAccessToken: encryptSecret(tokens.access_token),
          ...(tokens.expiry_date ? { tokenExpiresAt: new Date(tokens.expiry_date) } : {}),
          ...(tokens.refresh_token ? { encryptedRefreshToken: encryptSecret(tokens.refresh_token) } : {}),
          lastRefreshedAt: new Date(),
        },
      }
    ).catch((err) => console.error("[ga4] failed to persist refreshed token:", err instanceof Error ? err.message : err));
  });
}

export class Ga4ConnectionError extends Error {
  constructor(
    public readonly code: "not_found" | "not_connected",
    message: string
  ) {
    super(message);
    this.name = "Ga4ConnectionError";
  }
}

/**
 * An OAuth2 client for one stored account, refreshing (and re-saving) its
 * access token automatically. For Phase 3+ GA4 API calls.
 */
export async function getAuthorizedClient(connectionId: string, clientFactory: () => Auth.OAuth2Client = createGa4OAuthClient): Promise<Auth.OAuth2Client> {
  const doc = await loadWithTokens(connectionId);
  if (!doc) throw new Ga4ConnectionError("not_found", "Google connection not found.");
  if (doc.status !== "active" || !doc.encryptedRefreshToken) {
    throw new Ga4ConnectionError("not_connected", `${doc.email} needs to be reconnected (status: ${doc.status}).`);
  }

  const client = clientFactory();
  client.setCredentials({
    refresh_token: decryptSecret(doc.encryptedRefreshToken),
    ...(doc.encryptedAccessToken ? { access_token: decryptSecret(doc.encryptedAccessToken) } : {}),
    expiry_date: doc.tokenExpiresAt?.getTime(),
  });
  persistRefreshedTokens(connectionId, client);
  return client;
}

export type ValidationOutcome = { ok: true } | { ok: false; reason: "revoked" | "config" | "transient" | "not_connected" };

/**
 * Proves the stored refresh token still works by forcing a refresh (an
 * access token alone can look valid for up to an hour after the user
 * revokes access). Updates status to match.
 */
export async function validateConnection(
  connectionId: string,
  clientFactory: () => Auth.OAuth2Client = createGa4OAuthClient
): Promise<{ outcome: ValidationOutcome; connection: PublicGoogleConnection | null }> {
  const doc = await loadWithTokens(connectionId);
  if (!doc) return { outcome: { ok: false, reason: "not_connected" }, connection: null };
  if (!doc.encryptedRefreshToken) return { outcome: { ok: false, reason: "not_connected" }, connection: toPublicConnection(doc) };

  const client = clientFactory();
  client.setCredentials({ refresh_token: decryptSecret(doc.encryptedRefreshToken) }); // no access token → forces a refresh

  let outcome: ValidationOutcome;
  try {
    const { token } = await client.getAccessToken();
    if (!token) throw new Error("empty access token");
    const now = new Date();
    await GoogleConnection.updateOne(
      { _id: connectionId },
      {
        $set: {
          status: "active",
          encryptedAccessToken: encryptSecret(token),
          ...(client.credentials.expiry_date ? { tokenExpiresAt: new Date(client.credentials.expiry_date) } : {}),
          ...(client.credentials.refresh_token && client.credentials.refresh_token !== decryptSecret(doc.encryptedRefreshToken)
            ? { encryptedRefreshToken: encryptSecret(client.credentials.refresh_token) }
            : {}),
          lastRefreshedAt: now,
          lastValidatedAt: now,
          lastError: null,
        },
      }
    );
    outcome = { ok: true };
  } catch (err) {
    outcome = { ok: false, reason: await recordRefreshFailure(connectionId, err) };
  }

  const updated = await GoogleConnection.findById(connectionId).lean<ConnectionLike>();
  return { outcome, connection: updated ? toPublicConnection(updated) : null };
}

/**
 * Disconnects locally: deletes the stored tokens, keeps the row (so themes
 * mapped to it in Phase 3 keep a named owner and their history). Does NOT
 * revoke at Google on purpose — the Sheets export uses the same OAuth
 * client, and Google revokes a whole client grant at once, so revoking here
 * could silently break Sheets export for the same Google account.
 */
export async function disconnectConnection(connectionId: string): Promise<PublicGoogleConnection | null> {
  const doc = await GoogleConnection.findByIdAndUpdate(
    connectionId,
    {
      $set: {
        status: "disconnected",
        encryptedAccessToken: null,
        encryptedRefreshToken: null,
        tokenExpiresAt: null,
        disconnectedAt: new Date(),
        lastError: null,
      },
    },
    { returnDocument: "after" }
  ).lean<ConnectionLike>();
  return doc ? toPublicConnection(doc) : null;
}
