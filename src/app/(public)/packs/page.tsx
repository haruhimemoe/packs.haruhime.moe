/**
 * @file src/app/(public)/packs/page.tsx
 * @desc /packs: page 1 of public packs, under the packs admins pinned. ISR: rebuilt at most
 *       once a day, or on the next visit after a public pack or a pin changes
 *       (revalidatePublicPacks).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import type { Metadata } from "next";
import { PublicPacksScreen } from "@/components/packs/PublicPacksScreen";
import { listPinnedPacks, listPublicPacks } from "@/services/public-packs";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Public packs",
  description: "Browse and search osu! beatmap packs that hosts have shared publicly.",
  alternates: { canonical: "/packs" },
};

export default async function PublicPacksPage() {
  const [result, pinned] = await Promise.all([listPublicPacks(1), listPinnedPacks()]);
  return <PublicPacksScreen {...result} pinned={pinned} />;
}
