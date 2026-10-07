/**
 * @file tests/integration/services/api-keys.test.ts
 * @desc One key per user: create, regenerate (the old key dies at once), revoke, concurrent
 *       creates, authentication, lastUsedAt throttling, a key whose user is gone, and a key that
 *       would act as a system account (haruhime pools).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Tue Oct 6, 2026
 */

import { apiKeyDisplay, hashApiKey } from "@haruhimemoe/next-kit/api-keys";
import { ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { getDb, getIdentityDb } from "@/lib/db";
import { createApiKey, getApiKeyInfo, revokeApiKey } from "@/services/api-keys";
import { apiCaller, freezeTime } from "../../helpers/api-key";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();
afterEach(() => vi.useRealTimers());

const keysOf = (userId: string) =>
  getDb()
    .collection("api_keys")
    .countDocuments({ userId: new ObjectId(userId) });

describe("createApiKey", () => {
  it("returns the key once and stores only its hash, prefix, and dates", async () => {
    freezeTime();
    const user = await createTestUser();
    expect(await getApiKeyInfo(user.id)).toBeNull();
    const { key, apiKey } = await createApiKey(user.id);
    expect(key).toMatch(/^hpk_[A-Za-z0-9_-]{43}$/);
    expect(apiKey).toEqual({
      prefix: apiKeyDisplay(key),
      createdAt: "2026-09-22T12:00:10.000Z",
      lastUsedAt: null,
      scopes: ["*"],
    });
    const stored = await getDb()
      .collection("api_keys")
      .findOne({ userId: new ObjectId(user.id) });
    expect(stored).toMatchObject({ prefix: apiKeyDisplay(key), hash: hashApiKey(key) });
    expect(JSON.stringify(stored)).not.toContain(key);
    expect(await getApiKeyInfo(user.id)).toEqual(apiKey);
  });

  it("regenerating replaces the key, and the old one stops working at once", async () => {
    const user = await createTestUser();
    const first = await createApiKey(user.id);
    await apiCaller(first.key);
    const second = await createApiKey(user.id);
    expect(await keysOf(user.id)).toBe(1);
    expect(await apiCaller(first.key)).toBeNull();
    expect(await apiCaller(second.key)).not.toBeNull();
    expect(second.apiKey.lastUsedAt).toBeNull();
  });

  it("leaves exactly one working key when two creates race", async () => {
    const user = await createTestUser();
    const [a, b] = await Promise.all([createApiKey(user.id), createApiKey(user.id)]);
    expect(await keysOf(user.id)).toBe(1);
    const working = await Promise.all([a, b].map((created) => apiCaller(created.key)));
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
    expect(await apiCaller(key)).toBeNull();
    expect(await getApiKeyInfo(user.id)).toBeNull();
    expect(await revokeApiKey(user.id)).toBe(false);
  });
});

describe("a key through the /api/v1 guard", () => {
  it("returns the owner", async () => {
    const user = await createTestUser({ username: "player1" });
    const { key } = await createApiKey(user.id);
    expect(await apiCaller(key)).toEqual({
      id: user.id,
      osuId: user.osuId,
      username: "player1",
      isAdmin: false,
    });
  });

  it.each(["", "hpk_short", "pk1.AQRFR0MgAQABAg", `hpk_${"A".repeat(43)}`])(
    "refuses %j",
    async (token) => {
      expect(await apiCaller(token)).toBeNull();
    },
  );

  it("refuses a key whose user record is gone", async () => {
    const user = await createTestUser();
    const { key } = await createApiKey(user.id);
    await getIdentityDb()
      .collection("user")
      .deleteOne({ _id: new ObjectId(user.id) });
    expect(await apiCaller(key)).toBeNull();
  });

  it("refuses a key stored for a system account, even one with an identity row", async () => {
    const poolsId = POOLS_ACCOUNT.id;
    const { key } = await createApiKey(poolsId);
    expect(await apiCaller(key)).toBeNull();
    await getIdentityDb()
      .collection("user")
      .insertOne({
        _id: new ObjectId(poolsId),
        osuId: 1,
        username: "haruhime pools",
      });
    expect(await apiCaller(key)).toBeNull();
  });

  it("refuses a key whose identity row is marked system or banned", async () => {
    const system = await createTestUser({ fields: { system: true } });
    const banned = await createTestUser({ fields: { bannedAt: new Date() } });
    expect(await apiCaller((await createApiKey(system.id)).key)).toBeNull();
    expect(await apiCaller((await createApiKey(banned.id)).key)).toBeNull();
  });

  it("writes lastUsedAt at most once an hour", async () => {
    freezeTime("2026-09-22T12:00:00.000Z");
    const user = await createTestUser();
    const { key } = await createApiKey(user.id);
    await apiCaller(key);
    expect((await getApiKeyInfo(user.id))?.lastUsedAt).toBe("2026-09-22T12:00:00.000Z");
    vi.setSystemTime(new Date("2026-09-22T12:59:59.999Z"));
    await apiCaller(key);
    expect((await getApiKeyInfo(user.id))?.lastUsedAt).toBe("2026-09-22T12:00:00.000Z");
    vi.setSystemTime(new Date("2026-09-22T13:00:00.000Z"));
    await apiCaller(key);
    expect((await getApiKeyInfo(user.id))?.lastUsedAt).toBe("2026-09-22T13:00:00.000Z");
  });
});
