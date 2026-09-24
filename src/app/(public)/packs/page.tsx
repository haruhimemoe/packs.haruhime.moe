/**
 * @file src/app/(public)/packs/page.tsx
 * @desc /packs: page 1 of public packs. ISR: rebuilt at most once a day, or on the next
 *       visit after a public pack changes (revalidatePublicPacks).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import type { Metadata } from "next";
import { PublicPacksScreen } from "@/components/packs/PublicPacksScreen";
import { listPublicPacks } from "@/services/public-packs";

export const revalidate = 86400;

export const metadata: Metadata = {
  title: "Public packs",
  description: "Browse and search osu! beatmap packs that hosts have shared publicly.",
  alternates: { canonical: "/packs" },
};

export default async function PublicPacksPage() {
  const result = await listPublicPacks(1);
  return <PublicPacksScreen {...result} />;
}
