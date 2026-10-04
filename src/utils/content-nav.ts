/**
 * @file src/utils/content-nav.ts
 * @desc Turns a section's registry entries into the items ContentNav, ContentIndex and
 *       ContentSearch take: a resolved href, the title, the nav title and the description.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Oct 4, 2026
 * @modified Sun Oct 4, 2026
 */

import { type ContentEntry, type ContentSection, contentPath } from "@haruhimemoe/next-kit/docs";
import type { ContentSearchItem } from "@haruhimemoe/ui";

/**
 * @function toNavItem
 * @param section {ContentSection} the section the entries live under
 * @returns {(entry: ContentEntry) => ContentSearchItem} maps one entry to its nav and search item
 */
export const toNavItem =
  (section: ContentSection) =>
  ({ slug, title, navTitle, description }: ContentEntry): ContentSearchItem => ({
    href: contentPath(section, slug),
    title,
    ...(navTitle ? { navTitle } : {}),
    description,
  });
