/**
 * @file src/components/pack/MagnetLinkRow.tsx
 * @desc One recorded magnet link: its short infohash and date, Copy (@haruhimemoe/ui CopyButton),
 *       Open, and for the owner or an admin a Remove that asks first (InlineConfirm).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { ButtonLink, CopyButton, InlineConfirm, Text } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { PackExport } from "@/schemas/pack-export";
import { formatShortDate } from "@/utils/date";
import { infohashOf } from "@/utils/magnet";

type MagnetLinkRowProps = {
  /** A canonical magnet link (canonicalLinks) and when it was added. */
  entry: PackExport;
  /** Removes the link; throws to keep the confirm open. Absent: no Remove. */
  onRemove?: (url: string) => Promise<void>;
};

/**
 * @function MagnetLinkRow
 * @param props {MagnetLinkRowProps} the link and, for its owner, how to remove it
 * @returns {JSX.Element} the list item
 */
export function MagnetLinkRow({ entry, onRemove }: MagnetLinkRowProps) {
  const t = useTranslations("packs.magnetLinkRow");
  const short = (infohashOf(entry.url) ?? "").slice(0, 8);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-c2 text-sm">{short}</span>
      <Text as="span" tone="muted">
        Added {formatShortDate(entry.createdAt)}
      </Text>
      <CopyButton
        text={entry.url}
        label={t("copyMagnetLink")}
        aria-label={t("copyMagnetLinkShort", { short })}
        copiedMessage={t("magnetLinkCopied")}
        failedMessage={t("couldnTCopyUse")}
        wrapperClassName="gap-2"
      />
      <ButtonLink
        href={entry.url}
        variant="secondary"
        aria-label={t("openMagnetLinkShort", { short })}
      >
        {t("open")}
      </ButtonLink>
      {onRemove ? (
        <InlineConfirm
          trigger={t("remove")}
          triggerProps={{ variant: "ghost", "aria-label": t("removeMagnetLinkShort", { short }) }}
          question={t("removeThisLinkAnyone")}
          cancelLabel={t("keepIt")}
          confirmLabel={t("yesRemove")}
          pendingLabel={t("removing")}
          confirmVariant="danger"
          onConfirm={() => onRemove(entry.url)}
        />
      ) : null}
    </li>
  );
}
