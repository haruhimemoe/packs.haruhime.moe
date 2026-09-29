/**
 * @file src/constants/seo.ts
 * @desc The site as @haruhimemoe/next-kit/seo sees it: name, origin, the home page's keyword
 *       title and the short suffix long titles take, the description, the static preview image, and haruhime.moe as the organization
 *       and parent site. Every metadata, robots, sitemap, JSON-LD and llms.txt helper reads it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { HARUHIME_ORG, type Site } from "@haruhimemoe/next-kit/seo";
import { SITE } from "@/constants/site";

/** The pools site, where the haruhime pools account's packs come from. */
export const POOLS_URL = "https://pools.haruhime.moe";

/** The BBCode editor, for the forum post that goes with a pack. */
export const BB_URL = "https://bb.haruhime.moe";

export const SEO_SITE: Site = {
  name: SITE.name,
  url: SITE.url,
  // With the " · packs.haruhime.moe" suffix: 46 characters, whole in search results.
  title: "osu! mappool pack builder",
  // A long pack name ends " · packs" instead, so the title stays within 60 characters.
  shortTitleSuffix: "packs",
  description: SITE.description,
  ogImages: [
    {
      url: "/opengraph-image.png",
      width: 1200,
      height: 630,
      alt: "packs: osu! beatmap packs for tournament hosts",
      type: "image/png",
    },
  ],
  organization: HARUHIME_ORG,
  parent: { name: "haruhime.moe", url: SITE.parentUrl },
};
