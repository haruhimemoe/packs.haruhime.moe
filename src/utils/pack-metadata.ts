/**
 * @file src/utils/pack-metadata.ts
 * @desc Page metadata for /p/[slug]. Only public, visible packs are indexed, get a canonical URL,
 *       and describe themselves; everything else is noindex with just a title. No openGraph key:
 *       a page-level openGraph replaces the root's whole object (dropping the site preview image),
 *       and Next fills og:title/description from title/description when the page leaves it out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import type { SavedPack } from "@/schemas/saved-pack";
import { metaDescription } from "@/utils/text";

/**
 * @function packMetadata
 * @param pack {SavedPack} the pack as this viewer sees it
 * @returns {Metadata} title, and for public visible packs: description and canonical
 */
export const packMetadata = (pack: SavedPack): Metadata => {
  if (pack.visibility !== "public" || pack.hiddenAt) {
    return { title: pack.name, robots: { index: false } };
  }
  const description = metaDescription(pack.description, pack.slots.length);
  return {
    title: pack.name,
    description,
    alternates: { canonical: `/p/${pack.slug}` },
    robots: { index: true },
  };
};
