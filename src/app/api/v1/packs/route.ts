/**
 * @file src/app/api/v1/packs/route.ts
 * @desc GET /api/v1/packs?page=: public packs, most recently updated first, API_PAGE_SIZE a page.
 *       POST: save a pack for the key's owner (same body and rules as the site; admin keys skip
 *       the saved-pack cap). Stats are computed after the response (services/pack-stats.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
 */

import { clientIp, jsonError, rateLimitSubject } from "@haruhimemoe/next-kit/server";
import { packInputSchema } from "@haruhimemoe/pool/service";
import { BAD_PAGE, parsePackBody } from "@/lib/api";
import { withApiKey } from "@/lib/api-auth";
import { listPublicApiPacks, toApiPack } from "@/services/api-packs";
import { createPack, PackLimitError } from "@/services/packs";
import { pageFromQuery } from "@/utils/paging";

/**
 * @function GET
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 200, 400, 401, 429
 */
export const GET = withApiKey(
  async (request) => {
    const page = pageFromQuery(request.url);
    if (page === null) return jsonError(400, BAD_PAGE);
    return Response.json(await listPublicApiPacks(page));
  },
  { scope: "read" },
);

/**
 * @function POST
 * @param request {Request} the incoming request
 * @returns {Promise<Response>} 201, 400, 401, 409, 413, 415, 429
 */
export const POST = withApiKey(
  async (request, caller) => {
    const body = await parsePackBody(request, packInputSchema);
    if (!body.ok) return body.response;
    try {
      const pack = await createPack(caller.id, body.data, {
        unlimited: caller.isAdmin,
        subject: rateLimitSubject(clientIp(request.headers)),
        author: { id: caller.id, name: caller.username },
      });
      return Response.json({ pack: toApiPack(pack, caller.username) }, { status: 201 });
    } catch (error) {
      if (error instanceof PackLimitError) return jsonError(409, error.message);
      throw error;
    }
  },
  { scope: "write" },
);
