/**
 * @file src/app/api/v1/packs/[slug]/route.ts
 * @desc One pack. GET: public and unlisted for any key; private and hidden only for the owner.
 *       PUT and DELETE: the owner's pack only. "Not yours" and "doesn't exist" are both 404.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { jsonError, PACK_NOT_FOUND, parseJsonBody } from "@/lib/api";
import { withApiKey } from "@/lib/api-auth";
import { packInputSchema } from "@/schemas/saved-pack";
import { getApiPack, toApiPack } from "@/services/api-packs";
import { deletePack, updatePack } from "@/services/packs";

type Context = { params: Promise<{ slug: string }> };

export const GET = withApiKey<Context>(async (_request, caller, { params }) => {
  const { slug } = await params;
  const pack = await getApiPack(slug, caller);
  if (!pack) return jsonError(404, PACK_NOT_FOUND);
  return Response.json({ pack });
});

export const PUT = withApiKey<Context>(async (request, caller, { params }) => {
  const { slug } = await params;
  const body = await parseJsonBody(request, packInputSchema);
  if (!body.ok) return body.response;
  const pack = await updatePack(slug, caller.id, body.data);
  if (!pack) return jsonError(404, PACK_NOT_FOUND);
  return Response.json({ pack: toApiPack(pack, caller.username) });
});

export const DELETE = withApiKey<Context>(async (_request, caller, { params }) => {
  const { slug } = await params;
  if (!(await deletePack(slug, caller.id))) return jsonError(404, PACK_NOT_FOUND);
  return new Response(null, { status: 204 });
});
