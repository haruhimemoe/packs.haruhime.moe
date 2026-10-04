/**
 * @file src/app/api/me/api-key/route.ts
 * @desc The signed-in user's API key (session auth, for the /me card). GET: prefix and dates.
 *       POST: create or regenerate (the old key stops working at once), 10 an hour; the full
 *       key is in this response only. DELETE: revoke. POST and DELETE read no body, so both
 *       refuse requests from other origins (refuseCrossSite).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Sat Oct 3, 2026
 */

import {
  jsonError,
  rateLimitHeaders,
  tooManyRequests,
  withHeaders,
} from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { refuseCrossSite } from "@/lib/api";
import { SERVER_ERROR } from "@/lib/api-auth";
import { getUserFromHeaders } from "@/lib/auth";
import { limiter } from "@/lib/rate-limit";
import { createApiKey, getApiKeyInfo, revokeApiKey } from "@/services/api-keys";

const SIGN_IN = "Sign in with osu! to manage your API key.";
const NO_KEY = "You don't have an API key.";
const NO_STORE = { "Cache-Control": "no-store" };

/** Every answer, success or error, leaves no-store set. */
const fail = (response: Response): Response => withHeaders(response, NO_STORE);

/**
 * @function GET
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 200, 401, 500
 */
export async function GET(request: Request) {
  try {
    const user = await getUserFromHeaders(request.headers);
    if (!user) return fail(jsonError(401, SIGN_IN));
    return fail(Response.json({ apiKey: await getApiKeyInfo(user.id) }));
  } catch (error) {
    console.error("api-key: request failed", error);
    return fail(jsonError(500, SERVER_ERROR));
  }
}

/**
 * @function POST
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 201, 401, 403, 429, 500
 */
export async function POST(request: Request) {
  try {
    const crossSite = refuseCrossSite(request);
    if (crossSite) return fail(crossSite);
    const user = await getUserFromHeaders(request.headers);
    if (!user) return fail(jsonError(401, SIGN_IN));
    const limit = await limiter.hit(RATE_LIMITS.keyCreate, user.id);
    if (!limit.allowed) return fail(tooManyRequests(limit));
    return fail(
      Response.json(await createApiKey(user.id), {
        status: 201,
        headers: rateLimitHeaders(limit),
      }),
    );
  } catch (error) {
    console.error("api-key: request failed", error);
    return fail(jsonError(500, SERVER_ERROR));
  }
}

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 204, 401, 403, 404, 500
 */
export async function DELETE(request: Request) {
  try {
    const crossSite = refuseCrossSite(request);
    if (crossSite) return fail(crossSite);
    const user = await getUserFromHeaders(request.headers);
    if (!user) return fail(jsonError(401, SIGN_IN));
    if (!(await revokeApiKey(user.id))) return fail(jsonError(404, NO_KEY));
    return fail(new Response(null, { status: 204 }));
  } catch (error) {
    console.error("api-key: request failed", error);
    return fail(jsonError(500, SERVER_ERROR));
  }
}
