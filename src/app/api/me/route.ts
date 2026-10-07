/**
 * @file src/app/api/me/route.ts
 * @desc DELETE: the caller deletes their packs data (API key, every pack they saved and its
 *       history). Their haruhime account stays: that's deleted on haruhime.moe/account, the only
 *       app that can write it. Same-origin only (refuseCrossSite: it reads no body), then at
 *       most RATE_LIMITS.dataDelete an hour per osu! account. 204, still signed in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { jsonError } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limiter } from "@/lib/rate-limit";
import { deletePacksData } from "@/services/account";

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 204, 401, 403, 429
 */
export async function DELETE(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, "Sign in with osu! to delete your packs data.");
  const limited = await limiter.refuseOverLimit(RATE_LIMITS.dataDelete, String(user.osuId));
  if (limited) return limited;
  await deletePacksData(user.id);
  return new Response(null, { status: 204 });
}
