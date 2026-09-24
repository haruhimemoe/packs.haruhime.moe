/**
 * @file src/app/api/packs/route.ts
 * @desc GET ?page=: one page of the caller's saved packs (OWN_PAGE_SIZE a page), never cached
 *       (Cache-Control: private, no-store; it's the caller's own list). POST: save a pack (owner
 *       = caller; body ownerId/slug are ignored; admins skip the saved-pack cap), under the
 *       /api/v1 write limit (RATE_LIMITS.apiWrite, per user, shared with the API). The pack's
 *       stats are computed after the response, on the caller's share of the osu! budget.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { BAD_PAGE, jsonError, parseJsonBody, SIGN_IN_REQUIRED } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { refuseOverLimit } from "@/lib/rate-limit";
import { packInputSchema } from "@/schemas/saved-pack";
import { createPack, listPacks, PackLimitError } from "@/services/packs";
import { clientIp, rateLimitSubject } from "@/utils/client-ip";
import { pageFromQuery } from "@/utils/paging";

/** Session-scoped reads: never a shared cache, never a stale copy on the caller's next load. */
const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const page = pageFromQuery(request.url);
  if (page === null) return jsonError(400, BAD_PAGE);
  return Response.json(await listPacks(user.id, page), { headers: PRIVATE_NO_STORE });
}

export async function POST(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user) return jsonError(401, SIGN_IN_REQUIRED);
  const limited = await refuseOverLimit(RATE_LIMITS.apiWrite, user.id);
  if (limited) return limited;
  const body = await parseJsonBody(request, packInputSchema);
  if (!body.ok) return body.response;
  try {
    return Response.json(
      {
        pack: await createPack(user.id, body.data, {
          unlimited: user.isAdmin,
          subject: rateLimitSubject(clientIp(request.headers)),
        }),
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof PackLimitError) return jsonError(409, error.message);
    throw error;
  }
}
