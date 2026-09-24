/**
 * @file src/app/api/v1/beatmaps/[id]/usage/route.ts
 * @desc GET /api/v1/beatmaps/{id}/usage: the archive pools one beatmap was used in, most recent
 *       year first, and how many pools. Public: no key, counted per
 *       IP (RATE_LIMITS.mapUsage), and CDN-cached (MAP_USAGE_CACHE). A bad id is a 400.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { MAP_USAGE_CACHE } from "@/constants/map-usage";
import { BAD_USAGE_ID, jsonError } from "@/lib/api";
import { withPublicApi } from "@/lib/api-auth";
import { beatmapIdTextSchema, beatmapUsageSchema } from "@/schemas/map-usage";
import { getMapUsage } from "@/services/map-usage";

type Context = { params: Promise<{ id: string }> };

export const GET = withPublicApi<Context>(RATE_LIMITS.mapUsage, async (_request, { params }) => {
  const id = beatmapIdTextSchema.safeParse((await params).id);
  if (!id.success) return jsonError(400, BAD_USAGE_ID);
  const [usage] = await getMapUsage([id.data]);
  return Response.json(beatmapUsageSchema.parse(usage), {
    headers: { "Cache-Control": MAP_USAGE_CACHE },
  });
});
