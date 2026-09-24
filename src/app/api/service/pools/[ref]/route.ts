/**
 * @file src/app/api/service/pools/[ref]/route.ts
 * @desc PUT: pools.haruhime.moe publishes one of its pools as a plain pack
 *       (src/services/pools-sync.ts). Needs `Authorization: Bearer <POOLS_SERVICE_TOKEN>`
 *       (src/lib/machine-auth.ts): 503 not_configured while it isn't set up, 401 for a wrong one,
 *       429 once one IP has failed too often. It reads no session or cookies, so it needs no
 *       cross-site guard. `ref` is the pools pool id; the body is exactly a pack input (unknown
 *       keys are a 400) with visibility required, and private is a 422. Answers 201 { slug,
 *       state: "created", listed }, 200 with state "updated" or "unchanged", or 410 gone when a
 *       moderator deleted the pool's pack. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { jsonError, parseJsonBody } from "@/lib/api";
import { refuseWithoutPoolsToken } from "@/lib/machine-auth";
import { withHeaders } from "@/lib/rate-limit";
import { poolsPackBodySchema, poolsRefSchema } from "@/schemas/pools-service";
import { syncPoolsPack } from "@/services/pools-sync";

type Context = { params: Promise<{ ref: string }> };

const NO_STORE = { "Cache-Control": "no-store" };
const BAD_REF = "Use a pools pool id: 1 to 64 lowercase letters, digits and dashes.";
const PRIVATE_POOL = "A pools pack is public or unlisted, never private.";
const POOL_GONE = "A moderator deleted this pool's pack, so it won't be created again.";

const noStore = (response: Response): Response => withHeaders(response, NO_STORE);

export async function PUT(request: Request, { params }: Context) {
  const refused = await refuseWithoutPoolsToken(request);
  if (refused) return refused;
  const { ref } = await params;
  if (!poolsRefSchema.safeParse(ref).success) return noStore(jsonError(400, BAD_REF));
  const body = await parseJsonBody(request, poolsPackBodySchema);
  if (!body.ok) return noStore(body.response);
  if (body.data.visibility === "private") {
    return noStore(jsonError(422, PRIVATE_POOL, "unprocessable"));
  }
  const answer = await syncPoolsPack(ref, body.data);
  if (!answer) return noStore(jsonError(410, POOL_GONE, "gone"));
  return Response.json(answer, {
    status: answer.state === "created" ? 201 : 200,
    headers: NO_STORE,
  });
}
