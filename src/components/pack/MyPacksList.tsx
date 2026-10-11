/**
 * @file src/components/pack/MyPacksList.tsx
 * @desc /me: one page of the signed-in user's saved packs, newest update first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { ButtonLink, TextLink } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("packs.myPacksList");
  if (packs.length === 0 && total > 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-c3">{t("thereAreNoPacks")}</p>
        <ButtonLink href="/me" variant="secondary">
          {t("backToYourNewest")}
        </ButtonLink>
      </div>
    );
  }
  if (packs.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-c3">{t("youHavenTSaved")}</p>
        <ButtonLink href="/new">{t("buildAPack")}</ButtonLink>
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
