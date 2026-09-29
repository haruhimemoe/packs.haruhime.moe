/**
 * @file src/app/(public)/p/[slug]/og.png/route.ts
 * @desc GET /p/[slug]/og.png: a public pack's link preview card (1200×630 PNG), drawn at request
 *       time by @haruhimemoe/brand's ogCard (resvg, Node.js runtime). Unlisted, private, hidden
 *       and missing packs get a 404: their pages keep the site's own preview image. Reads no
 *       cookies. The page links it with ?v=<hash of the card's text>, so the CDN can keep a card
 *       for a week.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { ogCard, PRODUCTS } from "@haruhimemoe/brand";
import { getPackForViewer } from "@/services/pack-reads";
import { isIndexed, packCard } from "@/utils/pack-metadata";

export const runtime = "nodejs";

/**
 * @function GET
 * @param _request {Request} unused
 * @param context {RouteContext<"/p/[slug]/og.png">} the pack's slug
 * @returns {Promise<Response>} 200 image/png for a public, visible pack; 404 otherwise
 */
export async function GET(_request: Request, { params }: RouteContext<"/p/[slug]/og.png">) {
  const { slug } = await params;
  const found = await getPackForViewer(slug, null);
  if (!found || !isIndexed(found.pack)) {
    return new Response("Not found", {
      status: 404,
      headers: { "Cache-Control": "public, max-age=0, s-maxage=300" },
    });
  }
  const png = ogCard(PRODUCTS.packs, packCard(found.pack));
  return new Response(png.slice().buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
