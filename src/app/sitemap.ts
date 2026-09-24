/**
 * @file src/app/sitemap.ts
 * @desc sitemap.xml: static pages, guides, docs, legal, /packs pages, and every public, visible
 *       pack (from the same query as the search index). ISR: rebuilt at most once a day, or after
 *       a public pack changes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { MetadataRoute } from "next";
import { DOC_SLUGS } from "@/constants/docs";
import { GUIDE_SLUGS } from "@/constants/guide";
import { LEGAL_SLUGS } from "@/constants/legal";
import { MAX_PUBLIC_PAGE, PUBLIC_PAGE_SIZE } from "@/constants/public-packs";
import { SITE } from "@/constants/site";
import { buildSearchIndex } from "@/services/public-packs";
import { publicPageHref } from "@/utils/paging";

export const revalidate = 86400;

const STATIC_PATHS = ["/", "/new", "/guide", "/brand"] as const;

const at = (path: string): string => `${SITE.url}${path}`;

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
  return [
    ...STATIC_PATHS.map((path) => ({ url: at(path) })),
    ...Array.from({ length: pages }, (_, i) => ({ url: at(publicPageHref(i + 1)) })),
    ...GUIDE_SLUGS.map((slug) => ({ url: at(`/guide/${slug}`) })),
    ...DOC_SLUGS.map((slug) => ({ url: at(`/docs/${slug}`) })),
    ...LEGAL_SLUGS.map((slug) => ({ url: at(`/legal/${slug}`) })),
    ...index.packs.map((pack) => ({ url: at(`/p/${pack.s}`), lastModified: pack.u })),
  ];
}
