/**
 * @file src/app/api/signout/route.ts
 * @desc POST /api/signout: signs out of the haruhime.moe session without leaving packs. Same-origin
 *       only (refuseCrossSite: it reads no body). Forwards only the session cookie to the hub's
 *       POST /api/auth/sign-out (Origin packs.haruhime.moe, redirect "manual"), which ends the
 *       session in identity; packs can't write there itself. Whatever the hub answers (or if it
 *       can't be reached), the response clears better-auth's session cookies and the shared
 *       `haruhime-signed-in` marker on .haruhime.moe (host-only locally), so this browser is
 *       signed out of every haruhime tool. 204, never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { noStore } from "@haruhimemoe/next-kit/server";
import { HUB_SIGN_OUT_PATH, SHARED_COOKIE_DOMAIN, SIGNED_IN_COOKIE, SITE } from "@/constants/site";
import { getHubUrl } from "@/env";
import { refuseCrossSite } from "@/lib/api";
import { clearingCookies, cookieDomainFor, sessionCookieHeader } from "@/utils/signout-cookies";

/** How long the hub gets to answer before packs clears the cookies anyway. */
const HUB_TIMEOUT_MS = 5000;

/**
 * @function endHubSession
 * @param cookie {string} the session cookie, as a Cookie header
 * @returns {Promise<void>} once the hub answered, failed or timed out (never throws)
 */
const endHubSession = async (cookie: string): Promise<void> => {
  try {
    await fetch(new URL(HUB_SIGN_OUT_PATH, getHubUrl()), {
      method: "POST",
      headers: { cookie, origin: SITE.url, "content-type": "application/json" },
      body: "{}",
      redirect: "manual",
      signal: AbortSignal.timeout(HUB_TIMEOUT_MS),
    });
  } catch (error) {
    console.warn("[signout] the hub's sign-out failed; clearing cookies anyway", error);
  }
};

/**
 * @function POST
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 204 with the cookies cleared, or 403 from another site
 */
export async function POST(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const cookie = sessionCookieHeader(request.headers.get("cookie"));
  if (cookie) await endHubSession(cookie);
  const url = new URL(request.url);
  const response = noStore(new Response(null, { status: 204 }));
  for (const line of clearingCookies({
    marker: SIGNED_IN_COOKIE,
    domain: cookieDomainFor(url.hostname, SHARED_COOKIE_DOMAIN),
    secure: url.protocol === "https:",
  })) {
    response.headers.append("Set-Cookie", line);
  }
  return response;
}
