/**
 * @file tests/integration/services/api-keys.test.ts
 * @desc One key per user: create, regenerate (the old key dies at once), revoke, concurrent
 *       creates, authentication, lastUsedAt throttling, and a key whose user is gone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiKeyPrefix, hashApiKey } from "@/lib/api-key";
import { getDb } from "@/lib/db";
import { getApiKeyModel } from "@/models/ApiKey";
import { authenticateApiKey, createApiKey, getApiKeyInfo, revokeApiKey } from "@/services/api-keys";
import { freezeTime } from "../../helpers/api-key";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();
afterEach(() => vi.useRealTimers());

const keysOf = (userId: string) =>
  getApiKeyModel().countDocuments({ userId: new ObjectId(userId) });

describe("createApiKey", () => {
  it("returns the key once and stores only its hash, prefix, and dates", async () => {
    freezeTime();
    const user = await createTestUser();
    expect(await getApiKeyInfo(user.id)).toBeNull();
    const { key, apiKey } = await createApiKey(user.id);
    expect(key).toMatch(/^hpk_[A-Za-z0-9_-]{43}$/);
    expect(apiKey).toEqual({
      prefix: apiKeyPrefix(key),
      createdAt: "2026-09-22T12:00:10.000Z",
      lastUsedAt: null,
    });
    const stored = await getDb()
      .collection("api_keys")
      .findOne({ userId: new ObjectId(user.id) });
    expect(stored).toMatchObject({ prefix: apiKeyPrefix(key), hash: hashApiKey(key) });
    expect(JSON.stringify(stored)).not.toContain(key);
    expect(await getApiKeyInfo(user.id)).toEqual(apiKey);
  });

  it("regenerating replaces the key, and the old one stops working at once", async () => {
    const user = await createTestUser();
    const first = await createApiKey(user.id);
    await authenticateApiKey(first.key);
    const second = await createApiKey(user.id);
    expect(await keysOf(user.id)).toBe(1);
    expect(await authenticateApiKey(first.key)).toBeNull();
    expect(await authenticateApiKey(second.key)).not.toBeNull();
    expect(second.apiKey.lastUsedAt).toBeNull();
  });

  it("leaves exactly one working key when two creates race", async () => {
    const user = await createTestUser();
    const [a, b] = await Promise.all([createApiKey(user.id), createApiKey(user.id)]);
    expect(await keysOf(user.id)).toBe(1);
    const working = await Promise.all([a, b].map((created) => authenticateApiKey(created.key)));
    expect(working.filter(Boolean)).toHaveLength(1);
  });

  it("keeps each user's key separate", async () => {
    const one = await createTestUser();
    const two = await createTestUser();
    await createApiKey(one.id);
    await createApiKey(two.id);
    expect(await keysOf(one.id)).toBe(1);
    expect(await keysOf(two.id)).toBe(1);
  });
});

describe("revokeApiKey", () => {
  it("deletes the key; a second revoke finds nothing", async () => {
    const user = await createTestUser();
    const { key } = await createApiKey(user.id);
    expect(await revokeApiKey(user.id)).toBe(true);
    expect(await authenticateApiKey(key)).toBeNull();
    expect(await getApiKeyInfo(user.id)).toBeNull();
    expect(await revokeApiKey(user.id)).toBe(false);
  });
});

describe("authenticateApiKey", () => {
  it("returns the owner", async () => {
    const user = await createTestUser({ username: "player1" });
    const { key } = await createApiKey(user.id);
    expect(await authenticateApiKey(key)).toEqual({
      id: user.id,
      osuId: user.osuId,
      username: "player1",
      isAdmin: false,
    });
  });

  it.each(["", "hpk_short", "pk1.AQRFR0MgAQABAg", `hpk_${"A".repeat(43)}`])(
    "refuses %j",
    async (token) => {
      expect(await authenticateApiKey(token)).toBeNull();
    },
  );

  it("refuses a key whose user record is gone", async () => {
    const user = await createTestUser();
    const { key } = await createApiKey(user.id);
    await getDb()
      .collection("user")
      .deleteOne({ _id: new ObjectId(user.id) });
    expect(await authenticateApiKey(key)).toBeNull();
  });

  it("writes lastUsedAt at most once an hour", async () => {
    freezeTime("2026-09-22T12:00:00.000Z");
    const user = await createTestUser();
    const { key } = await createApiKey(user.id);
    await authenticateApiKey(key);
    expect((await getApiKeyInfo(user.id))?.lastUsedAt).toBe("2026-09-22T12:00:00.000Z");
    vi.setSystemTime(new Date("2026-09-22T12:59:59.999Z"));
    await authenticateApiKey(key);
    expect((await getApiKeyInfo(user.id))?.lastUsedAt).toBe("2026-09-22T12:00:00.000Z");
    vi.setSystemTime(new Date("2026-09-22T13:00:00.000Z"));
    await authenticateApiKey(key);
    expect((await getApiKeyInfo(user.id))?.lastUsedAt).toBe("2026-09-22T13:00:00.000Z");
  });
});
