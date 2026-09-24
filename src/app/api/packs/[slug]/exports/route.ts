/**
 * @file src/app/api/packs/[slug]/exports/route.ts
 * @desc Magnet links on a saved pack. POST adds one, DELETE (?url=) removes one; both owner-only.
 *       "Not yours" and "doesn't exist" are both 404, so private slugs are never confirmed. Both
 *       count against the /api/v1 write limit (RATE_LIMITS.apiWrite, per user, shared with the API).
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
import { magnetSchema, packExportInputSchema } from "@/schemas/pack-export";
import {
  addMagnet,
  ExportConflictError,
  ExportLimitError,
  removeMagnet,
  StalePackError,
} from "@/services/pack-exports";

type Context = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: Context) {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  const body = await parseJsonBody(request, packExportInputSchema, {
    tooLarge: "That magnet link is too long.",
  });
  if (!body.ok) return body.response;
  try {
    const exports = await addMagnet(slug, user.id, {
      url: body.data.url,
      packKey: body.data.packKey,
    });
    if (!exports) return jsonError(404, PACK_NOT_FOUND);
    return Response.json({ exports });
  } catch (error) {
    if (
      error instanceof ExportLimitError ||
      error instanceof StalePackError ||
      error instanceof ExportConflictError
    ) {
      return jsonError(409, error.message);
    }
    throw error;
  }
}

export async function DELETE(request: Request, { params }: Context) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  const url = magnetSchema.safeParse(new URL(request.url).searchParams.get("url") ?? "");
  if (!url.success) {
    return jsonError(400, url.error.issues[0]?.message ?? "That isn't a torrent magnet link.");
  }
  try {
    const exports = await removeMagnet(slug, user.id, url.data);
    if (!exports) return jsonError(404, PACK_NOT_FOUND);
    return Response.json({ exports });
  } catch (error) {
    if (error instanceof ExportConflictError) return jsonError(409, error.message);
    throw error;
  }
}
