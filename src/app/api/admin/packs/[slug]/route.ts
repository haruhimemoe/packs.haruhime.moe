/**
 * @file src/app/api/admin/packs/[slug]/route.ts
 * @desc Moderation, admins only. PATCH { hidden } hides or unhides a public/unlisted pack; DELETE
 *       removes it. Everyone else, and every private pack, gets the same 404, so the route never
 *       confirms it exists. DELETE reads no body, so it refuses requests from other origins
 *       (refuseCrossSite).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { jsonError, parseJsonBody, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders, type SessionUser } from "@/lib/auth";
import { moderationBodySchema } from "@/schemas/public-pack";
import { adminDeletePack, setPackHidden } from "@/services/moderation";

type Context = { params: Promise<{ slug: string }> };

const NOT_FOUND = "Not found.";

const adminFrom = async (request: Request): Promise<SessionUser | null> => {
  const user = await getUserFromHeaders(request.headers);
  return user?.isAdmin ? user : null;
};

export async function PATCH(request: Request, { params }: Context) {
  const { slug } = await params;
  const admin = await adminFrom(request);
  if (!admin) return jsonError(404, NOT_FOUND);
  const body = await parseJsonBody(request, moderationBodySchema);
  if (!body.ok) return body.response;
  const pack = await setPackHidden(slug, admin.id, body.data.hidden);
  if (!pack) return jsonError(404, NOT_FOUND);
  return Response.json({ pack });
}

export async function DELETE(request: Request, { params }: Context) {
  const { slug } = await params;
  const admin = await adminFrom(request);
  if (!admin) return jsonError(404, NOT_FOUND);
  // After the admin check, so everyone else still gets the same 404.
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  if (!(await adminDeletePack(slug))) return jsonError(404, NOT_FOUND);
  return new Response(null, { status: 204 });
}
