/**
 * @file src/app/(public)/page.tsx
 * @desc Homepage. ISR: rebuilt at most once a day, or after a public pack changes. The
 *       recent-packs strip is best effort: with no database (local dev, CI, an outage) the page
 *       renders without it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { homeMetadata } from "@haruhimemoe/next-kit/seo";
import type { Metadata } from "next";
import { HomeScreen } from "@/components/home/HomeScreen";
import { SEO_SITE } from "@/constants/seo";
import type { PublicPackCard, PublicPackPage } from "@/schemas/public-pack";
import { listPublicPacks } from "@/services/public-packs";

export const revalidate = 86400;

// "osu! mappool pack builder · packs.haruhime.moe": 46 characters, whole in search results.
export const metadata: Metadata = homeMetadata(SEO_SITE);

const RECENT_COUNT = 6;

/**
 * @function loadRecentPacks
 * @param load {(page: number) => Promise<PublicPackPage>} list loader (tests)
 * @returns {Promise<PublicPackCard[]>} the newest public packs, or [] when they can't load
 */
export const loadRecentPacks = async (
  load: (page: number) => Promise<PublicPackPage> = listPublicPacks,
): Promise<PublicPackCard[]> => {
  try {
    return (await load(1)).packs.slice(0, RECENT_COUNT);
  } catch {
    return [];
  }
};

/**
 * @function HomePage
 * @returns {Promise<JSX.Element>} the page
 */
export default async function HomePage() {
  return <HomeScreen recent={await loadRecentPacks()} />;
}
