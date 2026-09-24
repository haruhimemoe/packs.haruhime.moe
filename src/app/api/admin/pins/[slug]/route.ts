/**
 * @file src/app/api/admin/pins/[slug]/route.ts
 * @desc Pinned packs, admins only. PUT pins a public pack that isn't hidden to the "Pinned" row
 *       on /packs (last; a pinned pack keeps its place), DELETE unpins it. Both answer
 *       { pins }, the pinned list in order. A pack that can't be pinned, or one past
 *       MAX_PINNED_PACKS, is a 409 that says why. Everyone else, and every private pack, gets the
 *       same 404, so the route never confirms it exists. Neither reads a body, so both refuse
 *       requests from other origins (refuseCrossSite).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { jsonError, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import type { PinnedPack } from "@/schemas/public-pack";
import { PinRefusedError, pinPack, unpinPack } from "@/services/pins";

type Context = { params: Promise<{ slug: string }> };

const NOT_FOUND = "Not found.";

/** Admin check, then the same-origin check, then the change; 404 for a pack admins can't see. */
const change = async (
  request: Request,
  { params }: Context,
  run: (slug: string) => Promise<PinnedPack[] | null>,
): Promise<Response> => {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user?.isAdmin) return jsonError(404, NOT_FOUND);
  // After the admin check, so everyone else still gets the same 404.
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  try {
    const pins = await run(slug);
    if (!pins) return jsonError(404, NOT_FOUND);
    return Response.json({ pins });
  } catch (error) {
    if (error instanceof PinRefusedError) return jsonError(409, error.message);
    throw error;
  }
};

export async function PUT(request: Request, context: Context) {
  return change(request, context, pinPack);
}

export async function DELETE(request: Request, context: Context) {
  return change(request, context, unpinPack);
}
