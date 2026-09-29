/**
 * @file src/utils/pack-metadata.ts
 * @desc Page metadata and structured data for /p/[slug]. Only public, visible packs are indexed;
 *       everything else is noindex (canonical and preview image still set). The title says what
 *       the page is for ("… map pack download"), so it doesn't compete with the pool's own page
 *       on pools. The description leads with the host's text (sentences with links dropped: a raw
 *       URL reads badly in a search result) and ends with the saved stats: map count, star range,
 *       mods. The JSON-LD is a CreativeWork (isBasedOn the pools page when the description links
 *       one) plus breadcrumbs. Indexed packs get their own link preview card (/p/[slug]/og.png,
 *       drawn by @haruhimemoe/brand's ogCard); the rest keep the site's image.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import type { OgCardOptions } from "@haruhimemoe/brand";
import {
  clampDescription,
  DESCRIPTION_MAX,
  ld,
  type OgImage,
  pageMetadata,
} from "@haruhimemoe/next-kit/seo";
import { formatStars } from "@haruhimemoe/osu/format";
import type { Metadata } from "next";
import { SEO_SITE } from "@/constants/seo";
import type { SavedPack } from "@/schemas/saved-pack";
import { countOf, excerpt } from "@/utils/text";

const POOLS_PAGE = /https:\/\/pools\.haruhime\.moe\/pools\/[A-Za-z0-9_-]+/;
const LINK = /https?:\/\//;
/** Below this much room, the host's text isn't worth a cut-off excerpt. */
const MIN_EXCERPT = 40;

/**
 * @function isIndexed
 * @param pack {SavedPack} the pack
 * @returns {boolean} true for a public pack that isn't hidden: indexed, with its own card
 */
export const isIndexed = (pack: SavedPack): boolean =>
  pack.visibility === "public" && !pack.hiddenAt;

// "5.20–6.41★", or one value when both ends round the same; null without stats.
const starRange = (stats: SavedPack["stats"]): string | null => {
  if (stats?.srMin == null || stats.srMax == null) return null;
  const [low, high] = [formatStars(stats.srMin), formatStars(stats.srMax)];
  return `${low === high ? low : `${low}–${high}`}★`;
};

/**
 * @function packCard
 * @param pack {SavedPack} the pack
 * @returns {OgCardOptions} its link preview card: "osu! mappool pack" over the name, then
 *          "13 maps · 5.20–6.41★ · NM HD" (stars and mods once the server has stats)
 */
export const packCard = (pack: SavedPack): OgCardOptions => {
  const stars = starRange(pack.stats);
  const parts = [countOf(pack.slots.length, "map"), ...(stars ? [stars] : [])];
  if (pack.stats?.mods.length) parts.push(pack.stats.mods.join(" "));
  return { eyebrow: "osu! mappool pack", title: pack.name, subtitle: parts.join(" · ") };
};

/**
 * @function packCardImage
 * @param pack {SavedPack} an indexed pack
 * @returns {OgImage} its card's URL, versioned by what the card says (so a rename or new stats
 *          get past caches), with size, alt and type
 */
export const packCardImage = (pack: SavedPack): OgImage => {
  const card = packCard(pack);
  let hash = 0x811c9dc5;
  for (const char of JSON.stringify(card)) {
    hash = Math.imul(hash ^ (char.codePointAt(0) ?? 0), 0x01000193) >>> 0;
  }
  return {
    url: `/p/${pack.slug}/og.png?v=${hash.toString(36)}`,
    width: 1200,
    height: 630,
    alt: `${pack.name}: ${card.subtitle}`,
    type: "image/png",
  };
};

/**
 * @function packFacts
 * @param pack {SavedPack} the pack
 * @returns {string} "13 maps, 5.20–6.40★, NM HD HR DT. Download as one zip or a torrent, or add
 *          it to an osu! collection." (stars and mods only once the server has stats)
 */
export const packFacts = (pack: SavedPack): string => {
  const { stats } = pack;
  const stars = starRange(stats);
  const parts = [countOf(pack.slots.length, "map"), ...(stars ? [stars] : [])];
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
 * @returns {Metadata} title (" · packs" once it's long), description, canonical, og:url and
 *          preview image (the pack's own card when indexed); noindex unless public and visible
 */
export const packMetadata = (pack: SavedPack): Metadata =>
  pageMetadata(SEO_SITE, {
    path: `/p/${pack.slug}`,
    title: isIndexed(pack) ? `${pack.name} map pack download` : pack.name,
    description: packDescription(pack),
    index: isIndexed(pack),
    ...(isIndexed(pack) ? { images: [packCardImage(pack)] } : {}),
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
