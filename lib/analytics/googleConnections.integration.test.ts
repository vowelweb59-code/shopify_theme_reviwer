import { randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import mongoose from "mongoose";
import type { OAuth2Client } from "google-auth-library";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GoogleConnection } from "@/models/google-connection";
import { decryptSecret } from "./crypto";
import { ANALYTICS_READONLY_SCOPE, type Ga4OAuthResult } from "./googleOAuth";
import { disconnectConnection, getAuthorizedClient, listConnections, saveConnectionFromOAuth, validateConnection } from "./googleConnections";

// Needs a real MongoDB (unique-index upserts are the thing under test).
// Opt-in so the default suite stays DB-free:
//   GA4_TEST_MONGODB_URI=mongodb://localhost:27017 npx vitest run lib/analytics
// Each test file uses its own database (dbName), dropped afterwards.
const uri = process.env.GA4_TEST_MONGODB_URI;

const oauthResult = (overrides: Partial<Ga4OAuthResult> = {}): Ga4OAuthResult => ({
  googleAccountId: "sub-A",
  email: "a@example.com",
  displayName: "Account A",
  accessToken: "access-A1",
  refreshToken: "refresh-A1",
  expiryDate: new Date(Date.now() + 3600_000),
  scopes: ["openid", ANALYTICS_READONLY_SCOPE],
  ...overrides,
});

const googleError = (error: string) => Object.assign(new Error(error), { response: { data: { error } } });

// Mimics OAuth2Client's refresh: getAccessToken() with no access token calls
// the token endpoint, updates credentials and emits "tokens".
function fakeClientFactory(behaviour: { refreshTo?: string; fail?: Error }) {
  return () => {
    const client = Object.assign(new EventEmitter(), {
      credentials: {} as Record<string, unknown>,
      setCredentials(c: Record<string, unknown>) {
        client.credentials = c;
      },
      async getAccessToken() {
        if (client.credentials.access_token) return { token: client.credentials.access_token };
        if (behaviour.fail) throw behaviour.fail;
        const fresh = { access_token: behaviour.refreshTo, expiry_date: Date.now() + 3600_000 };
        client.credentials = { ...client.credentials, ...fresh };
        client.emit("tokens", fresh);
        return { token: behaviour.refreshTo };
      },
    });
    return client as unknown as OAuth2Client;
  };
}

const withTokens = (id: unknown) => GoogleConnection.findById(id).select("+encryptedAccessToken +encryptedRefreshToken");

describe.skipIf(!uri)("GoogleConnection lifecycle (MongoDB)", () => {
  beforeAll(async () => {
    vi.stubEnv("ANALYTICS_TOKEN_ENCRYPTION_KEY", randomBytes(32).toString("base64"));
    await mongoose.connect(uri!, { dbName: "ga4_test_connections" }); // own DB: test files run in parallel
    await GoogleConnection.syncIndexes();
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await GoogleConnection.deleteMany({});
  });

  it("stores a new account with encrypted tokens", async () => {
    const { connection, isReconnect } = await saveConnectionFromOAuth(oauthResult());
    expect(isReconnect).toBe(false);
    expect(connection).not.toHaveProperty("encryptedRefreshToken");

    const raw = await mongoose.connection.collection("googleconnections").findOne({});
    expect(raw?.encryptedRefreshToken).not.toContain("refresh-A1");
    expect(decryptSecret(raw!.encryptedRefreshToken)).toBe("refresh-A1");
  });

  it("keeps multiple accounts side by side", async () => {
    await saveConnectionFromOAuth(oauthResult());
    await saveConnectionFromOAuth(oauthResult({ googleAccountId: "sub-B", email: "b@example.com", refreshToken: "refresh-B" }));
    await saveConnectionFromOAuth(oauthResult({ googleAccountId: "sub-C", email: "c@example.com", refreshToken: "refresh-C" }));
    const list = await listConnections();
    expect(list.map((c) => c.email)).toEqual(["a@example.com", "b@example.com", "c@example.com"]);
    expect(JSON.stringify(list)).not.toMatch(/encrypted|refresh-/);
  });

  it("updates the same row on reconnect, even if the email changed", async () => {
    const first = await saveConnectionFromOAuth(oauthResult());
    await disconnectConnection(first.connection.id);
    const again = await saveConnectionFromOAuth(oauthResult({ email: "renamed@example.com", refreshToken: "refresh-A2" }));
    expect(again.isReconnect).toBe(true);
    expect(again.connection.id).toBe(first.connection.id);
    expect(again.connection.status).toBe("active");
    expect(await GoogleConnection.countDocuments()).toBe(1);
    expect(decryptSecret((await withTokens(first.connection.id))!.encryptedRefreshToken!)).toBe("refresh-A2");
  });

  it("keeps the stored refresh token when Google omits one on reconnect", async () => {
    const first = await saveConnectionFromOAuth(oauthResult());
    await saveConnectionFromOAuth(oauthResult({ refreshToken: null, accessToken: "access-A2" }));
    expect(decryptSecret((await withTokens(first.connection.id))!.encryptedRefreshToken!)).toBe("refresh-A1");
  });

  it("refuses a brand-new account without a refresh token", async () => {
    await expect(saveConnectionFromOAuth(oauthResult({ refreshToken: null }))).rejects.toMatchObject({ code: "missing_refresh_token" });
    expect(await GoogleConnection.countDocuments()).toBe(0);
  });

  it("disconnect deletes tokens but keeps the row", async () => {
    const { connection } = await saveConnectionFromOAuth(oauthResult());
    const result = await disconnectConnection(connection.id);
    expect(result?.status).toBe("disconnected");
    const doc = await withTokens(connection.id);
    expect(doc?.encryptedAccessToken).toBeNull();
    expect(doc?.encryptedRefreshToken).toBeNull();
    await expect(getAuthorizedClient(connection.id)).rejects.toMatchObject({ code: "not_connected" });
  });

  it("validation refreshes and re-encrypts the access token", async () => {
    const { connection } = await saveConnectionFromOAuth(oauthResult());
    const { outcome, connection: after } = await validateConnection(connection.id, fakeClientFactory({ refreshTo: "access-A-fresh" }));
    expect(outcome).toEqual({ ok: true });
    expect(after?.lastRefreshedAt).not.toBeNull();
    expect(decryptSecret((await withTokens(connection.id))!.encryptedAccessToken!)).toBe("access-A-fresh");
  });

  it("marks revoked access (invalid_grant) and drops the dead tokens", async () => {
    const { connection } = await saveConnectionFromOAuth(oauthResult());
    const { outcome, connection: after } = await validateConnection(connection.id, fakeClientFactory({ fail: googleError("invalid_grant") }));
    expect(outcome).toEqual({ ok: false, reason: "revoked" });
    expect(after?.status).toBe("revoked");
    expect((await withTokens(connection.id))?.encryptedRefreshToken).toBeNull();
  });

  it("leaves status alone on a transient failure", async () => {
    const { connection } = await saveConnectionFromOAuth(oauthResult());
    const { outcome, connection: after } = await validateConnection(connection.id, fakeClientFactory({ fail: new Error("ETIMEDOUT") }));
    expect(outcome).toEqual({ ok: false, reason: "transient" });
    expect(after?.status).toBe("active");
    expect(after?.lastError).toMatch(/Try again/);
  });

  it("persists an automatic refresh from getAuthorizedClient", async () => {
    const { connection } = await saveConnectionFromOAuth(oauthResult());
    await GoogleConnection.updateOne({ _id: connection.id }, { $set: { encryptedAccessToken: null } }); // simulate an expired access token
    const client = await getAuthorizedClient(connection.id, fakeClientFactory({ refreshTo: "access-auto" }));
    await client.getAccessToken();
    await vi.waitFor(async () => {
      const doc = await withTokens(connection.id);
      expect(doc?.encryptedAccessToken && decryptSecret(doc.encryptedAccessToken)).toBe("access-auto");
    });
  });
});
