/**
 * @file src/utils/pack-list-ld.ts
 * @desc JSON-LD for a page of public packs (/packs, /packs/page/{n}): a CollectionPage whose main
 *       entity is the ItemList of the packs on that page, plus breadcrumbs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { ld } from "@haruhimemoe/next-kit/seo";
import { SEO_SITE } from "@/constants/seo";

const NAME = "Public osu! mappool packs";

/**
 * @function packListLd
 * @param packs {readonly { slug: string; name: string }[]} the packs on the page, in page order
 * @param path {string} the page's path ("/packs", "/packs/page/2")
 * @param page {number} the page number (1-based)
 * @returns {object} a JSON-LD graph: CollectionPage (with the ItemList) and breadcrumbs
 */
export const packListLd = (
  packs: readonly { slug: string; name: string }[],
  path: string,
  page: number,
) => {
  const name = page > 1 ? `${NAME}, page ${page}` : NAME;
  const trail = [
    { name: "packs", path: "/" },
    { name: NAME, path: "/packs" },
    ...(page > 1 ? [{ name: `Page ${page}`, path }] : []),
  ];
  return ld.graph(
    {
      "@type": "CollectionPage",
      name,
      url: `${SEO_SITE.url}${path}`,
      isPartOf: { "@id": `${SEO_SITE.url}/#website` },
      mainEntity: ld.itemList(
        SEO_SITE,
        packs.map((pack) => ({ name: pack.name, path: `/p/${pack.slug}` })),
        { name },
      ),
    },
    ld.breadcrumbs(SEO_SITE, trail),
  );
};
