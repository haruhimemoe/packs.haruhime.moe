/**
 * @file src/app/api/v1/packs/[slug]/route.ts
 * @desc One pack. GET: public and unlisted for any key; private and hidden only for the owner.
 *       PUT and DELETE: the owner's pack only. "Not yours" and "doesn't exist" are both 404. A PUT
 *       that changes the maps clears the stats and computes new ones after the response.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { clientIp, jsonError, rateLimitSubject } from "@haruhimemoe/next-kit/server";
import { packInputSchema } from "@haruhimemoe/pool/service";
import { PACK_NOT_FOUND, parsePackBody } from "@/lib/api";
import { withApiKey } from "@/lib/api-auth";
import { getApiPack, toApiPack } from "@/services/api-packs";
import { deletePack, updatePack } from "@/services/packs";

type Context = { params: Promise<{ slug: string }> };

/**
 * @function GET
 * @param request {Request} the incoming request
 * @param context {{ params }} the route segment
 * @returns {Promise<Response>} 200, 404
 */
export const GET = withApiKey<Context>(async (_request, caller, { params }) => {
  const { slug } = await params;
  const pack = await getApiPack(slug, caller);
  if (!pack) return jsonError(404, PACK_NOT_FOUND);
  return Response.json({ pack });
});

/**
 * @function PUT
 * @param request {Request} the incoming request
 * @param context {{ params }} the route segment
 * @returns {Promise<Response>} 200, 400, 404, 413, 415
 */
export const PUT = withApiKey<Context>(async (request, caller, { params }) => {
  const { slug } = await params;
  const body = await parsePackBody(request, packInputSchema);
  if (!body.ok) return body.response;
  const pack = await updatePack(slug, caller.id, body.data, {
    subject: rateLimitSubject(clientIp(request.headers)),
    author: { id: caller.id, name: caller.username },
  });
  if (!pack) return jsonError(404, PACK_NOT_FOUND);
  return Response.json({ pack: toApiPack(pack, caller.username) });
});

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @param context {{ params }} the route segment
 * @returns {Promise<Response>} 204, 404
 */
export const DELETE = withApiKey<Context>(async (_request, caller, { params }) => {
  const { slug } = await params;
  if (!(await deletePack(slug, caller.id))) return jsonError(404, PACK_NOT_FOUND);
  return new Response(null, { status: 204 });
});
