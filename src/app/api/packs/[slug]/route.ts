/**
 * @file src/app/api/packs/[slug]/route.ts
 * @desc One saved pack. GET honours visibility, and tells the page whether the viewer owns it or
 *       is an admin (who may remove magnet links, and pin the pack: admins also get `pinned`);
 *       PUT and DELETE are owner-only. "Not yours" and
 *       "doesn't exist" are both 404, so private slugs are never confirmed. GET varies by viewer
 *       (isOwner, isAdmin) and can hold private or hidden packs, so it's never cached (Cache-
 *       Control: private, no-store), even though it isn't prerendered today. Writes count against
 *       the /api/v1 write limit (RATE_LIMITS.apiWrite, per user, shared with the API).
 *       DELETE reads no body, so it refuses requests from other origins (refuseCrossSite). A PUT
 *       that changes the maps clears the stats and computes new ones after the response.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { clientIp, jsonError, rateLimitSubject } from "@haruhimemoe/next-kit/server";
import { packInputSchema } from "@haruhimemoe/pool/service";
import { RATE_LIMITS } from "@/constants/api";
import { PACK_NOT_FOUND, parsePackBody, refuseCrossSite, SIGN_IN_REQUIRED } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limiter } from "@/lib/rate-limit";
import { getPackForViewer } from "@/services/pack-reads";
import { deletePack, updatePack } from "@/services/packs";
import { isPackPinned } from "@/services/pins";

type Context = { params: Promise<{ slug: string }> };

/** Session-scoped reads: never a shared cache, never a stale copy on the caller's next load. */
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * @function GET
 * @param request {Request} the incoming request
 * @param context {{ params }} the route segment
 * @returns {Promise<Response>} 200, 404
 */
export async function GET(request: Request, { params }: Context) {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  const found = await getPackForViewer(slug, user?.id ?? null, {
    isAdmin: user?.isAdmin ?? false,
  });
  if (!found) return jsonError(404, PACK_NOT_FOUND);
  const isAdmin = user?.isAdmin ?? false;
  return Response.json(
    { ...found, isAdmin, ...(isAdmin ? { pinned: await isPackPinned(slug) } : {}) },
    { headers: PRIVATE_NO_STORE },
  );
}

/**
 * @function PUT
 * @param request {Request} the incoming request
 * @param context {{ params }} the route segment
 * @returns {Promise<Response>} 200, 400, 401, 404, 413, 415, 429
 */
export async function PUT(request: Request, { params }: Context) {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await limiter.refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  const body = await parsePackBody(request, packInputSchema);
  if (!body.ok) return body.response;
  const pack = await updatePack(slug, user.id, body.data, {
    subject: rateLimitSubject(clientIp(request.headers)),
    author: { id: user.id, name: user.username },
  });
  if (!pack) return jsonError(404, PACK_NOT_FOUND);
  return Response.json({ pack });
}

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @param context {{ params }} the route segment
 * @returns {Promise<Response>} 204, 401, 403, 404, 429
 */
export async function DELETE(request: Request, { params }: Context) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await limiter.refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  if (!(await deletePack(slug, user.id))) return jsonError(404, PACK_NOT_FOUND);
  return new Response(null, { status: 204 });
}
