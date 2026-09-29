/**
 * @file src/app/sitemap.ts
 * @desc sitemap.xml: static pages, guides, docs, legal, /packs pages, and every public, visible
 *       pack (from the same query as the search index). Guides, docs and legal pages are dated by
 *       their lastUpdated, packs by their last update; pages with no real date get none. ISR:
 *       rebuilt at most once a day, or after a public pack changes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { sitemapEntries } from "@haruhimemoe/next-kit/seo";
import type { MetadataRoute } from "next";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { MAX_PUBLIC_PAGE, PUBLIC_PAGE_SIZE } from "@/constants/public-packs";
import { SEO_SITE } from "@/constants/seo";
import { buildSearchIndex } from "@/services/public-packs";
import { publicPageHref } from "@/utils/paging";

export const revalidate = 86400;

const STATIC_PATHS = ["/", "/new", "/guide", "/brand"] as const;

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
    GUIDE_SLUGS.map((slug) => ({
      path: `/guide/${slug}`,
      lastModified: GUIDE_DOCS[slug].lastUpdated,
    })),
    DOC_SLUGS.map((slug) => ({ path: `/docs/${slug}`, lastModified: DOC_DOCS[slug].lastUpdated })),
    LEGAL_SLUGS.map((slug) => ({
      path: `/legal/${slug}`,
      lastModified: LEGAL_DOCS[slug].lastUpdated,
    })),
    index.packs.map((pack) => ({ path: `/p/${pack.s}`, lastModified: pack.u })),
  ]);
}
