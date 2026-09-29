/**
 * @file src/app/(public)/packs/page.tsx
 * @desc /packs: page 1 of public packs, under the packs admins pinned. ISR: rebuilt at most
 *       once a day, or on the next visit after a public pack or a pin changes
 *       (revalidatePublicPacks).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { pageMetadata } from "@haruhimemoe/next-kit/seo";
import { JsonLd } from "@haruhimemoe/ui";
import type { Metadata } from "next";
import { PublicPacksScreen } from "@/components/packs/PublicPacksScreen";
import { SEO_SITE } from "@/constants/seo";
import { listPinnedPacks, listPublicPacks } from "@/services/public-packs";
import { packListLd } from "@/utils/pack-list-ld";

export const revalidate = 86400;

export const metadata: Metadata = pageMetadata(SEO_SITE, {
  path: "/packs",
  title: "Public osu! mappool packs",
  description:
    "osu! tournament mappool packs that hosts shared publicly. Filter by star rating, length, BPM and mods, and download a pool as one zip or a torrent.",
});

/**
 * @function PublicPacksPage
 * @returns {Promise<JSX.Element>} the page
 */
export default async function PublicPacksPage() {
  const [result, pinned] = await Promise.all([listPublicPacks(1), listPinnedPacks()]);
  return (
    <>
      <PublicPacksScreen {...result} pinned={pinned} />
      <JsonLd data={packListLd(result.packs, "/packs", 1)} />
    </>
  );
}
