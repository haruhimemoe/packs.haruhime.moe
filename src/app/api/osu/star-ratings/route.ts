/**
 * @file src/app/api/osu/star-ratings/route.ts
 * @desc GET ?q=129891:HD,129891:HDHR: star ratings with mods from osu! (via the Mongo cache and
 *       the global osu! budget in src/lib/osu/attributes.ts). A complete answer is CDN-cached for
 *       a day; an answer with pending pairs isn't, and the browser asks again. Never 5xx. Each IP
 *       (IPv6 by its /64) gets RATE_LIMITS.osuStarRatings requests a minute (then 429 with
 *       Retry-After, which the browser treats like pending pairs and asks again) and
 *       OSU_API_BUDGET_PER_IP osu! calls a minute, shared with /api/osu/beatmaps (past it, pairs
 *       come back pending).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { RATE_LIMITS } from "@/constants/api";
import { MAX_STAR_PAIRS } from "@/constants/star-ratings";
import { jsonError } from "@/lib/api";
import { getStarRatings } from "@/lib/osu/attributes";
import { refuseOverLimit } from "@/lib/rate-limit";
import { starPairsQuerySchema } from "@/schemas/star-ratings";
import { clientIp, rateLimitSubject } from "@/utils/client-ip";

const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: Request) {
  const subject = rateLimitSubject(clientIp(request.headers));
  const refused = await refuseOverLimit(RATE_LIMITS.osuStarRatings, subject);
  if (refused) return refused;
  const parsed = starPairsQuerySchema.safeParse(new URL(request.url).searchParams.get("q") ?? "");
  if (!parsed.success) {
    return jsonError(400, `Pass 1 to ${MAX_STAR_PAIRS} pairs like ?q=129891:HD,129891:HDHR.`);
  }
  const result = await getStarRatings(parsed.data, { subject });
  return Response.json(result, {
    headers: { "Cache-Control": result.pending.length === 0 ? CDN_CACHE : "no-store" },
  });
}
