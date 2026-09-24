/**
 * @file src/app/api/v1/packs/route.ts
 * @desc GET /api/v1/packs?page=: public packs, most recently updated first, API_PAGE_SIZE a page.
 *       POST: save a pack for the key's owner (same body and rules as the site; admin keys skip
 *       the saved-pack cap).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { BAD_PAGE, jsonError, parseJsonBody } from "@/lib/api";
import { withApiKey } from "@/lib/api-auth";
import { packInputSchema } from "@/schemas/saved-pack";
import { listPublicApiPacks, toApiPack } from "@/services/api-packs";
import { createPack, PackLimitError } from "@/services/packs";
import { pageFromQuery } from "@/utils/paging";

export const GET = withApiKey(async (request) => {
  const page = pageFromQuery(request.url);
  if (page === null) return jsonError(400, BAD_PAGE);
  return Response.json(await listPublicApiPacks(page));
});

export const POST = withApiKey(async (request, caller) => {
  const body = await parseJsonBody(request, packInputSchema);
  if (!body.ok) return body.response;
  try {
    const pack = await createPack(caller.id, body.data, { unlimited: caller.isAdmin });
    return Response.json({ pack: toApiPack(pack, caller.username) }, { status: 201 });
  } catch (error) {
    if (error instanceof PackLimitError) return jsonError(409, error.message);
    throw error;
  }
});
