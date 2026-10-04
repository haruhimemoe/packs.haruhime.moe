/**
 * @file src/utils/content-ld.ts
 * @desc JSON-LD for content pages: a TechArticle dated by the entry's lastUpdated, a HowTo when
 *       the entry has steps, and breadcrumbs (packs, the section, the page), as one graph.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import {
  type ContentEntry,
  type ContentSection,
  contentPath,
  SECTION_LABELS,
} from "@haruhimemoe/next-kit/docs";
import { ld } from "@haruhimemoe/next-kit/seo";
import { SEO_SITE } from "@/constants/seo";

/**
 * @function docJsonLd
 * @param section {ContentSection} the section the page lives under
 * @param entry {ContentEntry} the page's registry entry
 * @returns {Record<string, unknown>} one graph: TechArticle, HowTo when the entry has steps, and
 *          breadcrumbs
 */
export const docJsonLd = (
  section: ContentSection,
  entry: ContentEntry,
): Record<string, unknown> => {
  const path = contentPath(section, entry.slug);
  const { title, description, howTo } = entry;
  return ld.graph(
    ld.techArticle(SEO_SITE, {
      path,
      headline: title,
      description,
      dateModified: entry.lastUpdated,
    }),
    ...(howTo ? [ld.howTo({ name: title, description, steps: howTo })] : []),
    ld.breadcrumbs(SEO_SITE, [
      { name: "packs", path: "/" },
      { name: SECTION_LABELS[section], path: `/${section}` },
      { name: title, path },
    ]),
  );
};

/**
 * @function guideJsonLd
 * @param entry {ContentEntry} the guide's registry entry
 * @returns {Record<string, unknown>} the guide's graph (see docJsonLd)
 */
export const guideJsonLd = (entry: ContentEntry): Record<string, unknown> =>
  docJsonLd("guides", entry);
