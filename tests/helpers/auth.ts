/**
 * @file tests/helpers/auth.ts
 * @desc createTestUser(): a real better-auth user + osu! account + session in the test database,
 *       with the signed session cookie a browser would send.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { makeSignature } from "better-auth/crypto";
import { OSU_PROVIDER_ID } from "@/constants/auth";
import { getAuth } from "@/lib/auth";
import { TEST_SERVER_ENV } from "./server-env";

let nextOsuId = 1000;

type TestUserOptions = {
  username?: string;
  osuId?: number;
  /** Stored on the session as better-auth would from a real request (default: none, stored as ""). */
  session?: { ipAddress?: string; userAgent?: string };
};

/**
 * @function createTestUser
 * @param options {TestUserOptions} overrides
 * @returns {Promise<{ id: string; osuId: number; username: string; cookie: string }>}
 */
export const createTestUser = async (
  options: TestUserOptions = {},
): Promise<{ id: string; osuId: number; username: string; cookie: string }> => {
  const ctx = await getAuth().$context;
  const osuId = options.osuId ?? nextOsuId++;
  const username = options.username ?? `player${osuId}`;
  const user = await ctx.internalAdapter.createUser(
    { email: `${osuId}@osu.local`, emailVerified: false, name: username, osuId, username },
    { method: "oauth", oauth: { providerId: OSU_PROVIDER_ID } },
  );
  await ctx.internalAdapter.createAccount({
    userId: user.id,
    providerId: OSU_PROVIDER_ID,
    accountId: String(osuId),
  });
  const session = await ctx.internalAdapter.createSession(user.id, false, options.session);
  const signature = await makeSignature(session.token, TEST_SERVER_ENV.BETTER_AUTH_SECRET);
  const cookie = `better-auth.session_token=${encodeURIComponent(`${session.token}.${signature}`)}`;
  return { id: user.id, osuId, username, cookie };
};
