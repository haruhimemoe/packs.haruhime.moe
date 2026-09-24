/**
 * @file src/components/pack/MyPacksList.tsx
 * @desc /me: one page of the signed-in user's saved packs, newest update first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import Link from "next/link";
import { ButtonLink } from "@/components/ui/ButtonLink";
import { VISIBILITY_OPTIONS } from "@/constants/visibility";
import type { SavedPackSummary } from "@/schemas/saved-pack";
import { formatShortDate } from "@/utils/date";

/**
 * @param packs {SavedPackSummary[]} this page's packs
 * @param total {number} every pack the user saved (an empty page past the end links back)
 */
export function MyPacksList({ packs, total }: { packs: SavedPackSummary[]; total: number }) {
  if (packs.length === 0 && total > 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-c3">There are no packs on this page.</p>
        <ButtonLink href="/me" variant="secondary">
          Back to your newest packs
        </ButtonLink>
      </div>
    );
  }
  if (packs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-c3">You haven't saved any packs yet.</p>
        <ButtonLink href="/new">Build a pack</ButtonLink>
      </div>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-b3">
      {packs.map((pack) => (
        <li
          key={pack.slug}
          className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3"
        >
          <Link
            href={`/p/${pack.slug}`}
            className="wrap-anywhere min-w-0 font-bold text-c1 transition-colors hover:text-h1"
          >
            {pack.name}
          </Link>
          <span className="text-c4 text-sm">
            {pack.slotCount} {pack.slotCount === 1 ? "map" : "maps"} ·{" "}
            {VISIBILITY_OPTIONS[pack.visibility].label}
            {pack.hidden ? " · Hidden" : ""} · Updated {formatShortDate(pack.updatedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
