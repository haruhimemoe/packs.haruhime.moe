/**
 * @file src/components/packs/PublicPackList.tsx
 * @desc Grid of public pack cards, or the empty state.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { PublicPackCard } from "@/components/packs/PublicPackCard";
import type { PublicPackCard as PublicPack } from "@/schemas/public-pack";

export function PublicPackList({ packs }: { packs: readonly PublicPack[] }) {
  if (packs.length === 0) {
    return (
      <p className="text-c3">
        No public packs yet. Save a pack and set it to Public to list it here.
      </p>
    );
  }
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {packs.map((pack) => (
        <PublicPackCard key={pack.slug} pack={pack} />
      ))}
    </ul>
  );
}
