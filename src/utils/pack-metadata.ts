/**
 * @file src/utils/pack-metadata.ts
 * @desc Page metadata and structured data for /p/[slug]. Only public, visible packs are indexed;
 *       everything else is noindex (canonical and preview image still set). The title says what
 *       the page is for ("… map pack download"), so it doesn't compete with the pool's own page
 *       on pools. The description leads with the host's text (sentences with links dropped: a raw
 *       URL reads badly in a search result) and ends with the saved stats: map count, star range,
 *       mods. The JSON-LD is a CreativeWork (isBasedOn the pools page when the description links
 *       one) plus breadcrumbs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { clampDescription, DESCRIPTION_MAX, ld, pageMetadata } from "@haruhimemoe/next-kit/seo";
import { formatStars } from "@haruhimemoe/osu/format";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";
import type { SavedPack } from "@/schemas/saved-pack";
import { countOf, excerpt } from "@/utils/text";

const POOLS_PAGE = /https:\/\/pools\.haruhime\.moe\/pools\/[A-Za-z0-9_-]+/;
const LINK = /https?:\/\//;
/** Below this much room, the host's text isn't worth a cut-off excerpt. */
const MIN_EXCERPT = 40;

const isIndexed = (pack: SavedPack): boolean => pack.visibility === "public" && !pack.hiddenAt;

/**
 * @function packFacts
 * @param pack {SavedPack} the pack
 * @returns {string} "13 maps, 5.20–6.40★, NM HD HR DT. Download as one zip or a torrent, or add
 *          it to an osu! collection." (stars and mods only once the server has stats)
 */
export const packFacts = (pack: SavedPack): string => {
  const { stats } = pack;
  const parts = [countOf(pack.slots.length, "map")];
  if (stats?.srMin != null && stats.srMax != null) {
    const [low, high] = [formatStars(stats.srMin), formatStars(stats.srMax)];
    parts.push(`${low === high ? low : `${low}–${high}`}★`);
  }
  if (stats?.mods.length) parts.push(stats.mods.join(" "));
  return `${parts.join(", ")}. Download as one zip or a torrent, or add it to an osu! collection.`;
};

/**
 * @function packDescription
 * @param pack {SavedPack} the pack
 * @returns {string} the host's description without its linked sentences, cut to fit, then
 *          packFacts; at most DESCRIPTION_MAX characters
 */
export const packDescription = (pack: SavedPack): string => {
  const facts = packFacts(pack);
  const text = (pack.description ?? "")
    .split(/(?<=[.!?])\s+|\n+/)
    .filter((sentence) => !LINK.test(sentence))
    .join(" ")
    .trim();
  const room = DESCRIPTION_MAX - facts.length - 1;
  if (!text || room < MIN_EXCERPT) return clampDescription(facts);
  return clampDescription(`${excerpt(text, room - 1)} ${facts}`);
};

/**
 * @function packMetadata
 * @param pack {SavedPack} the pack as this viewer sees it
 * @returns {Metadata} title, description, canonical, og:url and preview image; noindex unless
 *          the pack is public and visible
 */
export const packMetadata = (pack: SavedPack): Metadata =>
  pageMetadata(SEO_SITE, {
    path: `/p/${pack.slug}`,
    title: isIndexed(pack) ? `${pack.name} map pack download` : pack.name,
    description: packDescription(pack),
    index: isIndexed(pack),
  });

/**
 * @function packLd
 * @param pack {SavedPack} the pack
 * @returns {object | null} a JSON-LD graph (CreativeWork and breadcrumbs) for a public, visible
 *          pack; null for any other
 */
export const packLd = (pack: SavedPack) => {
  if (!isIndexed(pack)) return null;
  const path = `/p/${pack.slug}`;
  const pool = pack.description?.match(POOLS_PAGE)?.[0];
  return ld.graph(
    ld.creativeWork(SEO_SITE, {
      path,
      name: pack.name,
      description: packDescription(pack),
      dateModified: pack.updatedAt,
      numberOfItems: pack.slots.length,
      genre: "osu! beatmap pack",
      ...(pool ? { isBasedOn: pool } : {}),
    }),
    ld.breadcrumbs(SEO_SITE, [
      { name: "packs", path: "/" },
      { name: "Public packs", path: "/packs" },
      { name: pack.name, path },
    ]),
  );
};
