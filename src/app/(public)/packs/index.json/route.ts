/**
 * @file src/app/(public)/packs/index.json/route.ts
 * @desc The public search index (up to 5,000 newest public packs). Static, rebuilt at most once
 *       a day or after a public pack changes; browsers filter it, so a search costs the
 *       server nothing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { buildSearchIndex } from "@/services/public-packs";

export const dynamic = "force-static";
export const revalidate = 86400;

export async function GET() {
  return Response.json(await buildSearchIndex());
}
