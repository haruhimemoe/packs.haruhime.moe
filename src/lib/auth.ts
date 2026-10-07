/**
 * @file src/lib/auth.ts
 * @desc Who a request comes from, read from the haruhime.moe hub's session. The hub is the only
 *       app that runs osu! sign-in; packs reads its `better-auth.session_token` cookie (on
 *       .haruhime.moe) with next-kit's createSessionReader: the signature checked against the
 *       shared BETTER_AUTH_SECRET, then the session and user read from the identity database,
 *       with zero writes (packs' Atlas user can only read identity). An old session pings the
 *       hub to refresh it there. A banned user reads as signed out (requireSession), and so does
 *       a system account (SYSTEM_USER_IDS, like the haruhime pools account), however a session
 *       reaches one. Admin rights come only from ADMIN_OSU_IDS, read on every request.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import {
  createSessionReader,
  requireSession,
  type SessionReaderInstance,
} from "@haruhimemoe/next-kit/auth";
import { SYSTEM_USER_IDS } from "@/constants/db";
import { getHubUrl, getServerEnv } from "@/env";
import { isAdminOsuId } from "@/lib/admin";
import { connectDb, getIdentityDb } from "@/lib/db";

/**
 * @function isSystemUserId
 * @param userId {string} a user id (hex)
 * @returns {boolean} true for a system account (the haruhime pools account)
 */
export const isSystemUserId = (userId: string): boolean => SYSTEM_USER_IDS.has(userId);

let reader: SessionReaderInstance | null = null;

/**
 * @function getSessionReader
 * @returns {SessionReaderInstance} the process-wide reader of the hub's session, built on first
 *          use (not at import, so builds need no env)
 */
export const getSessionReader = (): SessionReaderInstance => {
  reader ??= createSessionReader({
    identityDb: getIdentityDb(),
    secret: getServerEnv().BETTER_AUTH_SECRET,
    hubUrl: getHubUrl(),
  });
  return reader;
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
 * @param headers {Headers} the request's headers (the hub's session cookie)
 * @returns {Promise<SessionUser | null>} the caller, or null when signed out, banned or a system
 *          account
 */
export const getUserFromHeaders = async (headers: Headers): Promise<SessionUser | null> => {
  await connectDb();
  const user = await requireSession(getSessionReader(), headers);
  if (!user || isSystemUserId(user.id)) return null;
  return {
    id: user.id,
    osuId: user.osuId,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isAdmin: isAdminOsuId(user.osuId),
  };
};
