/**
 * @file src/components/history/ChangeList.tsx
 * @desc One version's changes, as lines from pack-changes.ts. A map line links the beatmap on
 *       osu!. The root (nothing to diff against) says so instead of showing an empty list.
 *       Server-safe.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Sun Oct 11, 2026
 */

import { EmptyState, SectionHeading, Surface, TextLink } from "@haruhimemoe/ui";
import type { RevisionMeta } from "@haruhimemoe/vcs";
import { useTranslations } from "next-intl";
import { formatShortDate } from "@/utils/date";
import type { ChangeLine } from "@/utils/pack-changes";

type ChangeListProps = {
  revision: RevisionMeta;
  /** null for the root: there's nothing before it to diff against. */
  lines: ChangeLine[] | null;
};

/**
 * @function ChangeList
 * @param props {ChangeListProps} the revision shown and its change lines (null for the root)
 * @returns {JSX.Element} a card listing what changed in that version
 */
export function ChangeList({ revision, lines }: ChangeListProps) {
  const t = useTranslations("packs.changeList");
  return (
    <Surface padding="md" className="flex flex-col gap-3">
      <SectionHeading level={3} detail={formatShortDate(revision.createdAt)}>
        {t("changesInThisVersion")}
      </SectionHeading>
      {lines === null ? (
        <p className="text-c2 text-sm">{t("theFirstSavedVersion")}</p>
      ) : lines.length === 0 ? (
        <EmptyState size="sm">{t("nothingAPersonWould")}</EmptyState>
      ) : (
        <ul className="flex flex-col gap-1 text-c2 text-sm">
          {lines.map((line, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: lines carry no stable id of their own
            <li key={index}>
              {line.beatmapId ? (
                <TextLink href={`https://osu.ppy.sh/b/${line.beatmapId}`} target="_blank">
                  {line.text}
                </TextLink>
              ) : (
                line.text
              )}
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}
