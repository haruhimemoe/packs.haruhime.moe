/**
 * @file src/app/(public)/page.tsx
 * @desc Homepage. ISR: rebuilt at most once a day, or after a public pack changes. The
 *       recent-packs strip shows the newest community packs (archive packs never fill it) and is
 *       best effort: with no database (local dev, CI, an outage) the page renders without it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import type { Metadata } from "next";
import { HomeScreen } from "@/components/home/HomeScreen";
import type { PublicPackCard } from "@/schemas/public-pack";
import { listRecentPacks } from "@/services/public-packs";

export const revalidate = 86400;

export const metadata: Metadata = {
  // With the " · packs.haruhime.moe" suffix: 46 characters, whole in search results.
  title: "osu! mappool pack builder",
  alternates: { canonical: "/" },
};

const RECENT_COUNT = 6;

/**
 * @function loadRecentPacks
 * @param load {(limit: number) => Promise<PublicPackCard[]>} recent packs loader (tests)
 * @returns {Promise<PublicPackCard[]>} the newest public community packs, or [] when they can't
 *          load
 */
export const loadRecentPacks = async (
  load: (limit: number) => Promise<PublicPackCard[]> = listRecentPacks,
): Promise<PublicPackCard[]> => {
  try {
    return (await load(RECENT_COUNT)).slice(0, RECENT_COUNT);
  } catch {
    return [];
  }
};

export default async function HomePage() {
  return <HomeScreen recent={await loadRecentPacks()} />;
}
