/**
 * @file src/app/api/me/route.ts
 * @desc DELETE: delete the caller's account and everything it owns. Same-origin only
 *       (refuseCrossSite): it reads no body.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { jsonError } from "@haruhimemoe/next-kit/server";
import { refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { deleteAccount } from "@/services/account";

/**
 * @function DELETE
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 204, 401, 403
 */
export async function DELETE(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, "Sign in with osu! to delete your account.");
  await deleteAccount(user.id);
  return new Response(null, { status: 204 });
}
