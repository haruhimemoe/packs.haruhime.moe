/**
 * @file src/app/api/packs/[slug]/route.ts
 * @desc One saved pack. GET honours visibility, and tells the page whether the viewer owns it or
 *       is an admin (who may remove magnet links); PUT and DELETE are owner-only. "Not yours" and
 *       "doesn't exist" are both 404, so private slugs are never confirmed. GET varies by viewer
 *       (isOwner, isAdmin) and can hold private or hidden packs, so it's never cached (Cache-
 *       Control: private, no-store), even though it isn't prerendered today. Writes count against
 *       the /api/v1 write limit (RATE_LIMITS.apiWrite, per user, shared with the API).
 *       DELETE reads no body, so it refuses requests from other origins (refuseCrossSite).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import {
  jsonError,
  PACK_NOT_FOUND,
  parseJsonBody,
  refuseCrossSite,
  SIGN_IN_REQUIRED,
} from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { refuseOverLimit } from "@/lib/rate-limit";
import { packInputSchema } from "@/schemas/saved-pack";
import { deletePack, getPackForViewer, updatePack } from "@/services/packs";

type Context = { params: Promise<{ slug: string }> };

/** Session-scoped reads: never a shared cache, never a stale copy on the caller's next load. */
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request, { params }: Context) {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  const found = await getPackForViewer(slug, user?.id ?? null, {
    isAdmin: user?.isAdmin ?? false,
  });
  if (!found) return jsonError(404, PACK_NOT_FOUND);
  return Response.json(
    { ...found, isAdmin: user?.isAdmin ?? false },
    { headers: PRIVATE_NO_STORE },
  );
}

export async function PUT(request: Request, { params }: Context) {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  const body = await parseJsonBody(request, packInputSchema);
  if (!body.ok) return body.response;
  const pack = await updatePack(slug, user.id, body.data);
  if (!pack) return jsonError(404, PACK_NOT_FOUND);
  return Response.json({ pack });
}

export async function DELETE(request: Request, { params }: Context) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  if (!(await deletePack(slug, user.id))) return jsonError(404, PACK_NOT_FOUND);
  return new Response(null, { status: 204 });
}
