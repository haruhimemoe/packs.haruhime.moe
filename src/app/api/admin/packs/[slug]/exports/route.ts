/**
 * @file src/app/api/admin/packs/[slug]/exports/route.ts
 * @desc Moderation, admins only: DELETE (?url=) removes one magnet link from a public or unlisted
 *       pack, through the same service as the owner's remove. Everyone else, and every private
 *       pack, gets the same 404, so the route never confirms it exists. It reads no body, so it
 *       refuses requests from other origins (refuseCrossSite).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { jsonError, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { magnetSchema } from "@/schemas/pack-export";
import { adminRemoveMagnet, ExportConflictError } from "@/services/pack-exports";

type Context = { params: Promise<{ slug: string }> };

const NOT_FOUND = "Not found.";

export async function DELETE(request: Request, { params }: Context) {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user?.isAdmin) return jsonError(404, NOT_FOUND);
  // After the admin check, so everyone else still gets the same 404.
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const url = magnetSchema.safeParse(new URL(request.url).searchParams.get("url") ?? "");
  if (!url.success) {
    return jsonError(400, url.error.issues[0]?.message ?? "That isn't a torrent magnet link.");
  }
  try {
    const exports = await adminRemoveMagnet(slug, url.data);
    if (!exports) return jsonError(404, NOT_FOUND);
    return Response.json({ exports });
  } catch (error) {
    if (error instanceof ExportConflictError) return jsonError(409, error.message);
    throw error;
  }
}
