/**
 * @file tests/integration/lib/auth.test.ts
 * @desc The hub session read against in-memory Mongo: session cookies resolve to our user shape,
 *       forged and expired ones don't, a banned user reads as signed out, and so does a system
 *       account (haruhime pools), however a session reaches it. Nothing is ever written to
 *       identity, and packs keeps no better-auth collections of its own.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { TEST_OSU_APP_ENV } from "@haruhimemoe/next-kit/testing";
import { makeSignature } from "better-auth/crypto";
import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { getUserFromHeaders, isSystemUserId } from "@/lib/auth";
import { getDb, getIdentityDb } from "@/lib/db";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

vi.stubEnv("ADMIN_OSU_IDS", "12231334");

setupTestDb();

describe("getUserFromHeaders", () => {
  it("returns the signed-in user for a valid session cookie", async () => {
    const user = await createTestUser({ username: "peppy" });
    expect(await getUserFromHeaders(new Headers({ cookie: user.cookie }))).toEqual({
      id: user.id,
      osuId: user.osuId,
      username: "peppy",
      avatarUrl: null,
      isAdmin: false,
    });
  });

  it("returns null without a cookie", async () => {
    expect(await getUserFromHeaders(new Headers())).toBeNull();
  });

  it("returns null for a forged cookie", async () => {
    const user = await createTestUser();
    const forged = user.cookie.replace(/\.[^.]+$/, ".forged");
    expect(forged).toMatch(/^better-auth\.session_token=[^.]+\.forged$/);
    expect(await getUserFromHeaders(new Headers({ cookie: forged }))).toBeNull();
  });

  it("flags users whose osu! id is in ADMIN_OSU_IDS", async () => {
    const admin = await createTestUser({ osuId: 12231334 });
    expect(await getUserFromHeaders(new Headers({ cookie: admin.cookie }))).toMatchObject({
      osuId: 12231334,
      isAdmin: true,
    });
  });
});

describe("expired sessions", () => {
  it("returns null for an expired session", async () => {
    const user = await createTestUser();
    await getIdentityDb()
      .collection("session")
      .updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await getUserFromHeaders(new Headers({ cookie: user.cookie }))).toBeNull();
  });
});

describe("banned and system accounts", () => {
  it("reads a banned user as signed out", async () => {
    const banned = await createTestUser({ fields: { bannedAt: new Date() } });
    expect(await getUserFromHeaders(new Headers({ cookie: banned.cookie }))).toBeNull();
  });

  it("knows the pools account is a system account, and nobody else", async () => {
    expect(isSystemUserId(POOLS_ACCOUNT.id)).toBe(true);
    expect(isSystemUserId(new ObjectId().toHexString())).toBe(false);
  });

  it("refuses a session that reaches the pools account anyway", async () => {
    const identity = getIdentityDb();
    const now = new Date();
    await identity.collection("user").insertOne({
      _id: new ObjectId(POOLS_ACCOUNT.id),
      osuId: 1,
      username: POOLS_ACCOUNT.name,
      avatarUrl: null,
      createdAt: now,
      updatedAt: now,
    });
    const token = "pools-session-token";
    await identity.collection("session").insertOne({
      token,
      userId: new ObjectId(POOLS_ACCOUNT.id),
      expiresAt: new Date(now.getTime() + 60_000),
      createdAt: now,
      updatedAt: now,
    });
    const signature = await makeSignature(token, TEST_OSU_APP_ENV.BETTER_AUTH_SECRET);
    const cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
    expect(await getUserFromHeaders(new Headers({ cookie }))).toBeNull();
  });
});

describe("read-only", () => {
  it("writes nothing to identity and keeps no auth collections in packs", async () => {
    const user = await createTestUser();
    const before = await getIdentityDb().collection("session").find().toArray();
    await getUserFromHeaders(new Headers({ cookie: user.cookie }));
    expect(await getIdentityDb().collection("session").find().toArray()).toEqual(before);
    const packs = (await getDb().listCollections().toArray()).map((c) => c.name);
    for (const name of ["user", "account", "session", "verification"]) {
      expect(packs).not.toContain(name);
    }
  });
});
