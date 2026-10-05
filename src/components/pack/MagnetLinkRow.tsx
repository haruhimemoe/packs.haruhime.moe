/**
 * @file src/components/pack/MagnetLinkRow.tsx
 * @desc One recorded magnet link: its short infohash and date, Copy (@haruhimemoe/ui CopyButton),
 *       Open, and for the owner or an admin a Remove that asks first (InlineConfirm).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { ButtonLink, CopyButton, InlineConfirm, Text } from "@haruhimemoe/ui";
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
  const short = (infohashOf(entry.url) ?? "").slice(0, 8);
  return (
    <li className="flex flex-wrap items-center gap-2">
      <span className="font-mono text-c2 text-sm">{short}</span>
      <Text as="span" tone="muted">
        Added {formatShortDate(entry.createdAt)}
      </Text>
      <CopyButton
        text={entry.url}
        label="Copy magnet link"
        aria-label={`Copy magnet link ${short}`}
        copiedMessage="Magnet link copied."
        failedMessage="Couldn't copy. Use Open, or copy the link by hand."
        wrapperClassName="gap-2"
      />
      <ButtonLink href={entry.url} variant="secondary" aria-label={`Open magnet link ${short}`}>
        Open
      </ButtonLink>
      {onRemove ? (
        <InlineConfirm
          trigger="Remove"
          triggerProps={{ variant: "ghost", "aria-label": `Remove magnet link ${short}` }}
          question="Remove this link? Anyone using it can't find it here after."
          cancelLabel="Keep it"
          confirmLabel="Yes, remove"
          pendingLabel="Removing…"
          confirmVariant="danger"
          onConfirm={() => onRemove(entry.url)}
        />
      ) : null}
    </li>
  );
}
