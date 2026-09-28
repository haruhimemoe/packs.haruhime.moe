/**
 * @file src/app/api/osu/beatmaps/route.ts
 * @desc GET ?ids=1,2,3: beatmap metadata from osu! for ids the mirror doesn't know, as
 *       { beatmaps, unchecked }. Every osu! call spends the shared osu! budget
 *       (src/lib/osu/attributes.ts). `unchecked` holds ids osu! couldn't check yet: the budget was
 *       spent or its counter failed (osu! is never called blind), or osu!'s row failed our schema.
 *       The browser shows those as retryable errors, never as missing. A complete answer is
 *       CDN-cached for a day so repeat lookups never reach osu!; one with unchecked ids isn't.
 *       Each IP (IPv6 by its /64) gets RATE_LIMITS.osuBeatmaps requests a minute (then 429 with
 *       Retry-After; the browser shows every asked id as unchecked, so it stays retryable), and
 *       its osu! calls spend the same per-IP share as star ratings (OSU_API_BUDGET_PER_IP; past
 *       it, ids come back unchecked).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { clientIp, jsonError, rateLimitSubject } from "@haruhimemoe/next-kit/server";
import { RATE_LIMITS } from "@/constants/api";
import { BAD_BEATMAP_IDS, parseBeatmapIds } from "@/lib/api";
import { osuBudgetGate } from "@/lib/osu/budget";
import { getOsuClient } from "@/lib/osu/client";
import { limiter } from "@/lib/rate-limit";

const CDN_CACHE = "public, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: Request) {
  const subject = rateLimitSubject(clientIp(request.headers));
  const limited = await limiter.refuseOverLimit(RATE_LIMITS.osuBeatmaps, subject);
  if (limited) return limited;
  const ids = parseBeatmapIds(new URL(request.url).searchParams.get("ids"));
  if (!ids) return jsonError(400, BAD_BEATMAP_IDS);
  // After the first "no" (or a failing counter), later batches stay unchecked without counting.
  const beforeCall = osuBudgetGate(subject);
  try {
    const { found, unchecked } = await getOsuClient().getBeatmaps(ids, { beforeCall });
    return Response.json(
      { beatmaps: [...found.values()], unchecked },
      { headers: { "Cache-Control": unchecked.length === 0 ? CDN_CACHE : "no-store" } },
    );
  } catch (error) {
    // An OsuApiError (token refused, 429/5xx, timeout, network, unreadable body): the same 502 as
    // before.
    console.error("[osu] fallback lookup failed:", error);
    return jsonError(502, "osu! didn't answer. Try again later.");
  }
}
