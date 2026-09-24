/**
 * @file src/app/api/cron/pack-stats/route.ts
 * @desc GET: the daily Vercel cron (vercel.json). Repairs missing or incomplete pack stats, one
 *       capped batch a run (runPackStatsJob), and answers { updated, remaining, waiting }. Vercel
 *       sends `Authorization: Bearer <CRON_SECRET>`. Fails closed (src/lib/machine-auth.ts): 503
 *       while CRON_SECRET isn't set or is too short, 401 for a missing or wrong secret, and
 *       neither does any work. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { refuseWithoutCronSecret } from "@/lib/machine-auth";
import { runPackStatsJob } from "@/services/pack-stats";

/** Hobby's limit without fluid compute; one batch takes a few seconds. */
export const maxDuration = 60;

const NO_STORE = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
  const refused = refuseWithoutCronSecret(request, "The stats job isn't set up on this server.");
  if (refused) return refused;
  return Response.json(await runPackStatsJob(), { headers: NO_STORE });
}
