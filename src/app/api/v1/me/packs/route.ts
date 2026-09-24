/**
 * @file src/app/api/v1/me/packs/route.ts
 * @desc GET /api/v1/me/packs?page=: the key's owner's packs, any visibility, most recently
 *       updated first, API_PAGE_SIZE a page (the same envelope as GET /api/v1/packs).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { BAD_PAGE, jsonError } from "@/lib/api";
import { withApiKey } from "@/lib/api-auth";
import { listOwnApiPacks } from "@/services/api-packs";
import { pageFromQuery } from "@/utils/paging";

export const GET = withApiKey(async (request, caller) => {
  const page = pageFromQuery(request.url);
  if (page === null) return jsonError(400, BAD_PAGE);
  return Response.json(await listOwnApiPacks(caller, page));
});
