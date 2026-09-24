/**
 * @file src/app/api/v1/beatmaps/usage/route.ts
 * @desc GET /api/v1/beatmaps/usage?ids=1,2,3: the archive pools each of up to MAX_USAGE_IDS
 *       beatmaps was used in, one answer per id in the order asked, each id once. Pack pages
 *       and the editor ask it once for all their maps. Public: no key, counted per IP
 *       (RATE_LIMITS.mapUsage), and CDN-cached (MAP_USAGE_CACHE), so the site asks with its ids
 *       sorted and every viewer of a pack shares one URL.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { MAP_USAGE_CACHE } from "@/constants/map-usage";
import { BAD_USAGE_IDS, jsonError } from "@/lib/api";
import { withPublicApi } from "@/lib/api-auth";
import { beatmapUsageListSchema, usageIdsQuerySchema } from "@/schemas/map-usage";
import { getMapUsage } from "@/services/map-usage";

export const GET = withPublicApi(RATE_LIMITS.mapUsage, async (request) => {
  const ids = usageIdsQuerySchema.safeParse(new URL(request.url).searchParams.get("ids") ?? "");
  if (!ids.success) return jsonError(400, BAD_USAGE_IDS);
  const beatmaps = await getMapUsage(ids.data);
  return Response.json(beatmapUsageListSchema.parse({ beatmaps }), {
    headers: { "Cache-Control": MAP_USAGE_CACHE },
  });
});
