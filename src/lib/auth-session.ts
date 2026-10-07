/**
 * @file src/lib/auth-session.ts
 * @desc Session helpers for server pages and layouts (they read next/headers). Route handlers
 *       use getUserFromHeaders(request.headers) from lib/auth instead. A page for signed-in
 *       people sends a visitor to the hub's osu! sign-in and back here.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import "server-only";
import { hubSignInUrl, safeNextPath } from "@haruhimemoe/next-kit/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { DEFAULT_AFTER_SIGN_IN, HUB_SIGN_IN_PATH, SITE } from "@/constants/site";
import { getHubUrl } from "@/env";
import { getUserFromHeaders, type SessionUser } from "@/lib/auth";

/**
 * @function hubSignInHref
 * @param next {string | null | undefined} a packs path to land on after signing in (unsafe or
 *        missing: DEFAULT_AFTER_SIGN_IN)
 * @returns {string} the hub's osu! sign-in route (`${HUB_URL}/api/signin/osu?next=`), which goes
 *          straight to osu! and comes back to that path on packs.haruhime.moe
 */
export const hubSignInHref = (next: string | null | undefined): string => {
  const path = safeNextPath(next, { fallback: DEFAULT_AFTER_SIGN_IN });
  return hubSignInUrl(new URL(path, SITE.url).href, {
    hubUrl: getHubUrl(),
    hosts: [new URL(SITE.url).hostname],
    signInPath: HUB_SIGN_IN_PATH,
  });
};

/**
 * @function getCurrentUser
 * @returns {Promise<SessionUser | null>} the signed-in user for this request, or null
 */
export const getCurrentUser = async (): Promise<SessionUser | null> =>
  getUserFromHeaders(await headers());

/**
 * @function requireUser
 * @param next {string} where sign-in should return to (the page asking)
 * @returns {Promise<SessionUser>} the signed-in user; redirects to the hub's sign-in when there
 *          is none
 */
export const requireUser = async (next = "/me"): Promise<SessionUser> => {
  const user = await getCurrentUser();
  if (!user) redirect(hubSignInHref(next));
  return user;
};
