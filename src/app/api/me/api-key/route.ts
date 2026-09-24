/**
 * @file src/app/api/me/api-key/route.ts
 * @desc The signed-in user's API key (session auth, for the /me card). GET: prefix and dates.
 *       POST: create or regenerate (the old key stops working at once), 10 an hour; the full
 *       key is in this response only. DELETE: revoke. POST and DELETE read no body, so both
 *       refuse requests from other origins (refuseCrossSite).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { jsonError, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { hitRateLimit, rateLimitHeaders, tooManyRequests, withHeaders } from "@/lib/rate-limit";
import { createApiKey, getApiKeyInfo, revokeApiKey } from "@/services/api-keys";

const SIGN_IN = "Sign in with osu! to manage your API key.";
const NO_KEY = "You don't have an API key.";
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN);
  return Response.json({ apiKey: await getApiKeyInfo(user.id) }, { headers: NO_STORE });
}

export async function POST(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN);
  const limit = await hitRateLimit(RATE_LIMITS.keyCreate, user.id);
  if (!limit.allowed) return withHeaders(tooManyRequests(limit), NO_STORE);
  return Response.json(await createApiKey(user.id), {
    status: 201,
    headers: { ...rateLimitHeaders(limit), ...NO_STORE },
  });
}

export async function DELETE(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN);
  if (!(await revokeApiKey(user.id))) return jsonError(404, NO_KEY);
  return new Response(null, { status: 204 });
}
