/**
 * @file src/lib/auth.ts
 * @desc better-auth from @haruhimemoe/next-kit's createOsuAuth, built on first use: osu! as the only
 *       way in (identify + public, PKCE), no osu! tokens stored, the signed-in marker cookie kept
 *       in step with the session. getUserFromHeaders() is how route handlers read the caller.
 *       System users (`system: true`, like the haruhime pools account) can never act: no session
 *       or osu! account link is ever created for one, and a session that reaches one anyway reads
 *       as signed out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import "server-only";
import { createOsuAuth, toSessionUser } from "@haruhimemoe/next-kit/auth";
import { ObjectId } from "mongodb";
import { SIGNED_IN_COOKIE } from "@/constants/site";
import { getServerEnv } from "@/env";
import { isAdminOsuId } from "@/lib/admin";
import { getDb, getMongoClient } from "@/lib/db";

/**
 * @function isSystemUser
 * @param userId {unknown} a user id as better-auth passes it (string or ObjectId)
 * @returns {Promise<boolean>} true for a system account (the haruhime pools account)
 */
export const isSystemUser = async (userId: unknown): Promise<boolean> => {
  const id =
    userId instanceof ObjectId
      ? userId
      : typeof userId === "string" && ObjectId.isValid(userId)
        ? new ObjectId(userId)
        : null;
  if (!id) return false;
  return (
    (await getDb().collection("user").countDocuments({ _id: id, system: true }, { limit: 1 })) > 0
  );
};

/** A write that would let a system account act: refused (false), anything else goes ahead. */
const refuseSystemUser = async (row: Record<string, unknown>): Promise<boolean | undefined> =>
  (await isSystemUser(row.userId)) ? false : undefined;

const createAuth = () => {
  const env = getServerEnv();
  return createOsuAuth({
    clientId: env.OSU_CLIENT_ID,
    clientSecret: env.OSU_CLIENT_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    db: getDb(),
    client: getMongoClient(),
    markerCookie: SIGNED_IN_COOKIE,
    // Set only by the server on system accounts. Nothing a client or an osu! profile sends can.
    userFields: { system: { type: "boolean", required: false, input: false } },
    hooks: { beforeAccountCreate: refuseSystemUser, beforeSessionCreate: refuseSystemUser },
  });
};

export type Auth = ReturnType<typeof createAuth>;

let instance: Auth | null = null;

/**
 * @function getAuth
 * @returns {Auth} the process-wide better-auth instance, built on first use
 */
export const getAuth = (): Auth => {
  instance ??= createAuth();
  return instance;
};

/** The signed-in caller, as routes and pages see them. */
export type SessionUser = {
  id: string;
  osuId: number;
  username: string;
  avatarUrl: string | null;
  isAdmin: boolean;
};

/**
 * @function getUserFromHeaders
 * @param headers {Headers} the request's headers (its session cookie)
 * @returns {Promise<SessionUser | null>} the caller, or null when signed out or a system account
 */
export const getUserFromHeaders = async (headers: Headers): Promise<SessionUser | null> => {
  const session = await getAuth().api.getSession({ headers });
  if (!session || session.user.system === true) return null;
  const user = toSessionUser(session);
  return { ...user, isAdmin: isAdminOsuId(user.osuId) };
};
