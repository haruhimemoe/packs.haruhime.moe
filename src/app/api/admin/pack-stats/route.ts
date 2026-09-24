/**
 * @file src/app/api/admin/pack-stats/route.ts
 * @desc POST: admins only. Runs one batch of the pack stats job now (the same one the daily cron
 *       runs) and answers { updated, remaining, waiting }, so a backfill can go faster than a
 *       batch a day.
 *       Everyone else gets the same 404 as other admin routes. It reads no body, so it refuses
 *       requests from other origins (refuseCrossSite). Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { jsonError, refuseCrossSite } from "@/lib/api";
import { getUserFromHeaders } from "@/lib/auth";
import { runPackStatsJob } from "@/services/pack-stats";

/** Hobby's limit without fluid compute; one batch takes a few seconds. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getUserFromHeaders(request.headers);
  if (!user?.isAdmin) return jsonError(404, "Not found.");
  // After the admin check, so everyone else still gets the same 404.
  const crossSite = refuseCrossSite(request);
  if (crossSite) return crossSite;
  return Response.json(await runPackStatsJob(), { headers: { "Cache-Control": "no-store" } });
}
