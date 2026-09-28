/**
 * @file src/components/pack/MagnetLinks.tsx
 * @desc /p/[slug] Download card's "Torrent" section (rendered first in the card): who added the
 *       links, a line and a guide link, then the magnet links the owner recorded (canonical: our
 *       trackers only, nothing else a torrent app would contact), each with its date, Copy and
 *       Open; the owner (and admins) can also remove them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { Notice, TextLink } from "@haruhimemoe/ui";
import { useId, useState } from "react";
import { MagnetLinkRow } from "@/components/pack/MagnetLinkRow";
import { PacksApiError } from "@/lib/packs-api";
import type { PackExport } from "@/schemas/pack-export";
import { canonicalLinks } from "@/utils/magnet";

type MagnetLinksProps = {
  exports: readonly PackExport[];
  /** The owner, or an admin. */
  onRemove?: (url: string) => Promise<void>;
};

/**
 * @function MagnetLinks
 * @param props {MagnetLinksProps} the pack's recorded links and, for its owner or an admin, how to
 *        remove one
 * @returns {JSX.Element | null} the Torrent section, or nothing when no link is valid
 */
export function MagnetLinks({ exports, onRemove }: MagnetLinksProps) {
  const [error, setError] = useState<string | null>(null);
  const headingId = useId();

  // The server already sends canonical links; this keeps anything else out of an href regardless.
  const links = canonicalLinks(exports);
  if (links.length === 0) return null;

  const remove = onRemove
    ? async (url: string) => {
        setError(null);
        try {
          await onRemove(url);
        } catch (cause) {
          setError(
            cause instanceof PacksApiError ? cause.message : "Couldn't remove it. Try again.",
          );
          throw cause;
        }
      }
    : undefined;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3">
      <h3 id={headingId} className="font-bold text-c1">
        Torrent
      </h3>
      <p className="text-c3 text-sm">
        Added by the pack owner. packs doesn't host or check these files.
      </p>
      <p className="text-c3 text-sm">
        Download with a torrent app. It only works while someone seeds it.{" "}
        <TextLink href="/guide/download-a-torrent">How to download with a torrent</TextLink>
      </p>
      <ul className="flex flex-col gap-3">
        {links.map((entry) => (
          <MagnetLinkRow key={entry.url} entry={entry} onRemove={remove} />
        ))}
      </ul>
      {error ? (
        <Notice tone="error" live className="font-bold">
          {error}
        </Notice>
      ) : null}
    </section>
  );
}
