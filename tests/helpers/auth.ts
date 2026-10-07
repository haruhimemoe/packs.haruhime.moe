/**
 * @file tests/helpers/auth.ts
 * @desc createTestUser(): an identity user and session written straight into the identity
 *       database (standing in for the haruhime.moe hub, which packs itself never writes), with
 *       the signed session cookie a browser would send.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { randomBytes } from "node:crypto";
import { TEST_OSU_APP_ENV } from "@haruhimemoe/next-kit/testing";
import { makeSignature } from "better-auth/crypto";
import { ObjectId } from "mongodb";
import { connectDb, getIdentityDb } from "@/lib/db";

let nextOsuId = 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

type TestUserOptions = {
  username?: string;
  osuId?: number;
  /** Extra identity user fields (bannedAt, system, countryCode). */
  fields?: Record<string, unknown>;
};

/**
 * @function createTestUser
 * @param options {TestUserOptions} overrides
 * @returns {Promise<{ id: string; osuId: number; username: string; cookie: string }>}
 */
export const createTestUser = async (
  options: TestUserOptions = {},
): Promise<{ id: string; osuId: number; username: string; cookie: string }> => {
  await connectDb();
  const identity = getIdentityDb();
  const osuId = options.osuId ?? nextOsuId++;
  const username = options.username ?? `player${osuId}`;
  const now = new Date();
  const _id = new ObjectId();
  await identity.collection("user").insertOne({
    _id,
    email: `${osuId}@osu.local`,
    emailVerified: false,
    name: username,
    osuId,
    username,
    avatarUrl: null,
    createdAt: now,
    updatedAt: now,
    ...options.fields,
  });
  const token = randomBytes(24).toString("base64url");
  await identity.collection("session").insertOne({
    _id: new ObjectId(),
    token,
    userId: _id,
    expiresAt: new Date(now.getTime() + 30 * DAY_MS),
    createdAt: now,
    updatedAt: now,
  });
  const signature = await makeSignature(token, TEST_OSU_APP_ENV.BETTER_AUTH_SECRET);
  const cookie = `better-auth.session_token=${encodeURIComponent(`${token}.${signature}`)}`;
  return { id: _id.toHexString(), osuId, username, cookie };
};
