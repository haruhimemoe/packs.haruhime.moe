/**
 * @file src/app/api/packs/[slug]/history/route.ts
 * @desc PUT: turn a saved pack's history public or private. Owner-only (null = not found or not
 *       yours, same as every pack write); reads and the page itself live in
 *       src/services/pack-history-read.ts. No GET: the history page reads the service directly.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { jsonError, parseJsonBody } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { PACK_NOT_FOUND, SIGN_IN_REQUIRED } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { limiter } from "@/lib/rate-limit";
import { historyBodySchema } from "@/schemas/pack-history";
import { setPackHistoryPublic } from "@/services/pack-history-read";

type Context = { params: Promise<{ slug: string }> };

/** Session-scoped reads: never a shared cache, never a stale copy on the caller's next load. */
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * @function PUT
 * @param request {Request} the incoming request
 * @param context {{ params }} the route segment
 * @returns {Promise<Response>} 200, 400, 401, 404, 429
 */
export async function PUT(request: Request, { params }: Context) {
  const { slug } = await params;
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await limiter.refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  const body = await parseJsonBody(request, historyBodySchema);
  if (!body.ok) return body.response;
  const ok = await setPackHistoryPublic(slug, user.id, body.data.historyPublic);
  if (!ok) return jsonError(404, PACK_NOT_FOUND);
  return Response.json({ historyPublic: body.data.historyPublic }, { headers: PRIVATE_NO_STORE });
}
