/**
 * @file src/app/sitemap.ts
 * @desc sitemap.xml: static pages, /packs pages, the docs, guides and legal sections (their
 *       index pages and every entry, from next-kit's contentSitemap), and every public, visible
 *       pack (from the same query as the search index). Content pages are dated by their
 *       lastUpdated (a section index by its newest entry), packs by their last update; pages
 *       with no real date get none. ISR: rebuilt at most once a day, or after a public pack
 *       changes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { contentSitemap } from "@haruhimemoe/next-kit/docs";
import { sitemapEntries } from "@haruhimemoe/next-kit/seo";
import type { MetadataRoute } from "next";
import { CONTENT } from "@/constants/content";
import { MAX_PUBLIC_PAGE, PUBLIC_PAGE_SIZE } from "@/constants/public-packs";
import { SEO_SITE } from "@/constants/seo";
import { buildSearchIndex } from "@/services/public-packs";
import { publicPageHref } from "@/utils/paging";

export const revalidate = 86400;

const STATIC_PATHS = ["/", "/new", "/brand"] as const;

/**
 * @function sitemap
 * @returns {Promise<MetadataRoute.Sitemap>} sitemap.xml: the static pages, the guides and the public packs
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // A database outage (at build or regeneration) drops the pack links, not the whole sitemap.
  const index = await buildSearchIndex().catch((error: unknown) => {
    console.error("sitemap: couldn't list public packs", error);
    return { v: 1 as const, packs: [] };
  });
  const pages = Math.min(
    MAX_PUBLIC_PAGE,
    Math.max(1, Math.ceil(index.packs.length / PUBLIC_PAGE_SIZE)),
  );
  return sitemapEntries(SEO_SITE, [
    STATIC_PATHS,
    Array.from({ length: pages }, (_, i) => publicPageHref(i + 1)),
    contentSitemap(CONTENT),
    index.packs.map((pack) => ({ path: `/p/${pack.s}`, lastModified: pack.u })),
  ]);
}
