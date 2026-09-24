/**
 * @file src/app/api/service/pools/stats/route.ts
 * @desc POST: pools.haruhime.moe fills in its packs' stats after a sync, about once a minute until
 *       `remaining` is 0: one batch of runPoolsStatsBackfill (src/services/pack-stats.ts) on the
 *       pools-sync share of the osu! budget, answering { updated, remaining }. The same token
 *       check as the pools PUT (src/lib/machine-auth.ts). Reads no body, session or cookies, and
 *       never creates the pools account. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { refuseWithoutPoolsToken } from "@/lib/machine-auth";
import { runPoolsStatsBackfill } from "@/services/pack-stats";

/** Hobby's limit without fluid compute; one batch takes a few seconds. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const refused = await refuseWithoutPoolsToken(request);
  if (refused) return refused;
  return Response.json(await runPoolsStatsBackfill(), {
    headers: { "Cache-Control": "no-store" },
  });
}
