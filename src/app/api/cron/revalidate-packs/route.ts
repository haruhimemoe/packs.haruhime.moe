/**
 * @file src/app/api/cron/revalidate-packs/route.ts
 * @desc POST: marks /packs, its pages, /packs/index.json, / and /sitemap.xml stale
 *       (revalidatePublicPacks), for the archive importer (`bun run archive:import`), which writes
 *       straight to the database from outside the site. Needs `Authorization: Bearer
 *       <CRON_SECRET>`; fails closed like the stats cron (src/lib/cron-auth.ts). Reads no body,
 *       does no database work, and answers { revalidated: true }. Never cached.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { refuseWithoutCronSecret } from "@/lib/cron-auth";
import { revalidatePublicPacks } from "@/lib/revalidate";

export async function POST(request: Request) {
  const refused = refuseWithoutCronSecret(
    request,
    "Refreshing /packs this way isn't set up on this server.",
  );
  if (refused) return refused;
  revalidatePublicPacks();
  return Response.json({ revalidated: true }, { headers: { "Cache-Control": "no-store" } });
}
