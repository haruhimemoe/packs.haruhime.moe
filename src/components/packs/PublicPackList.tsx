/**
 * @file src/components/packs/PublicPackList.tsx
 * @desc Grid of public pack cards, or the empty state. Cards show the date the list is ordered
 *       by: when each pack was added (default), or when it was last updated.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

import { CardGrid } from "@haruhimemoe/ui";
import { type PackCardDate, PublicPackCard } from "@/components/packs/PublicPackCard";
import type { PublicPackCard as PublicPack } from "@/schemas/public-pack";

type PublicPackListProps = {
  packs: readonly PublicPack[];
  date?: PackCardDate;
};

/**
 * @function PublicPackList
 * @param props {PublicPackListProps} packs, date
 * @returns {JSX.Element} grid of public pack cards, or the empty state
 */
export function PublicPackList({ packs, date }: PublicPackListProps) {
  if (packs.length === 0) {
    return (
      <p className="text-c3">
        No public packs yet. Save a pack and set it to Public to list it here.
      </p>
    );
  }
  return (
    <CardGrid gap="sm">
      {packs.map((pack) => (
        <PublicPackCard key={pack.slug} pack={pack} date={date} />
      ))}
    </CardGrid>
  );
}
