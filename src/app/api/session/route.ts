/**
 * @file src/app/api/session/route.ts
 * @desc GET /api/session: who the hub's session cookie says is signed in, for the header's
 *       account store (src/lib/account.ts): `{ user: { id, username, avatarUrl } }`, or
 *       `{ user: null }` signed out, banned or a system account. Read with next-kit's session
 *       reader, no writes. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { noStore } from "@haruhimemoe/next-kit/server";
import { getUserFromHeaders } from "@/lib/auth";

/**
 * @function GET
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 200 with the user, or with null
 */
export async function GET(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  return noStore(
    Response.json({
      user: user ? { id: user.id, username: user.username, avatarUrl: user.avatarUrl } : null,
    }),
  );
}
