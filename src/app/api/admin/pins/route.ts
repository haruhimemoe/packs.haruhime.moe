/**
 * @file src/app/api/admin/pins/route.ts
 * @desc PUT { slugs }: admins only. Puts the pinned packs in the order given and answers
 *       { pins }. The list has to name every pinned pack once and nothing else; otherwise a pin
 *       changed since the admin's page loaded, and it's a 409. Everyone else gets the same 404
 *       as other admin routes. Refuses requests from other origins (refuseCrossSite) on top of
 *       the JSON body check.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { jsonError, parseJsonBody, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { pinOrderBodySchema } from "@/schemas/public-pack";
import { PinRefusedError, reorderPins } from "@/services/pins";

export async function PUT(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user?.isAdmin) return jsonError(404, "Not found.");
  // After the admin check, so everyone else still gets the same 404.
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const body = await parseJsonBody(request, pinOrderBodySchema, {
    tooLarge: "That list is too large.",
  });
  if (!body.ok) return body.response;
  try {
    return Response.json({ pins: await reorderPins(body.data.slugs) });
  } catch (error) {
    if (error instanceof PinRefusedError) return jsonError(409, error.message);
    throw error;
  }
}
