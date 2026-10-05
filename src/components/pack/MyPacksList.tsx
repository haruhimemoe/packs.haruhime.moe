/**
 * @file src/components/pack/MyPacksList.tsx
 * @desc /me: one page of the signed-in user's saved packs, newest update first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { ButtonLink, TextLink } from "@haruhimemoe/ui";
import { VISIBILITY_OPTIONS } from "@/constants/visibility";
import type { SavedPackSummary } from "@/schemas/saved-pack";
import { formatShortDate } from "@/utils/date";
import { countOf } from "@/utils/text";

/**
 * @param packs {SavedPackSummary[]} this page's packs
 * @param total {number} every pack the user saved (an empty page past the end links back)
 */
/**
 * @function MyPacksList
 * @param props {{ packs; total }} this page of saved packs and how many there are
 * @returns {JSX.Element} the /me list of saved packs
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
          <TextLink href={`/p/${pack.slug}`} variant="plain" className="wrap-anywhere min-w-0">
            {pack.name}
          </TextLink>
          <span className="text-c4 text-sm">
            {countOf(pack.slotCount, "map")} · {VISIBILITY_OPTIONS[pack.visibility].label}
            {pack.hidden ? " · Hidden" : ""} · Updated {formatShortDate(pack.updatedAt)}
          </span>
        </li>
      ))}
    </ul>
  );
}
