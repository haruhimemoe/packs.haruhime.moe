/**
 * @file src/lib/auth-session.ts
 * @desc Session helpers for server pages and layouts (they read next/headers). Route handlers
 *       use getUserFromHeaders(request.headers) from lib/auth instead.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserFromHeaders, type SessionUser } from "@/lib/auth";
import { signInHref } from "@/utils/safe-next";

/**
 * @function getCurrentUser
 * @returns {Promise<SessionUser | null>} the signed-in user for this request, or null
 */
export const getCurrentUser = async (): Promise<SessionUser | null> =>
  getUserFromHeaders(await headers());

/**
 * @function requireUser
 * @param next {string} where sign-in should return to (the page asking)
 * @returns {Promise<SessionUser>} the signed-in user; redirects to /signin?next= when there is none
 */
export const requireUser = async (next = "/me"): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) redirect(signInHref(next));
  return user;
};
