/**
 * @file src/app/api/me/route.ts
 * @desc DELETE: delete the caller's account and everything it owns. Same-origin only
 *       (refuseCrossSite): it reads no body.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { jsonError, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { deleteAccount } from "@/services/account";

export async function DELETE(request: Request) {
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, "Sign in with osu! to delete your account.");
  await deleteAccount(user.id);
  return new Response(null, { status: 204 });
}
