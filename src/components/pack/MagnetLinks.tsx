/**
 * @file src/components/pack/MagnetLinks.tsx
 * @desc /p/[slug] Download card's "Torrent" section (rendered first in the card): who added the
 *       links, a line and a guide link, then the magnet links the owner recorded (canonical: our
 *       trackers only, nothing else a torrent app would contact), each with its date, Copy and
 *       Open; the owner (and admins) can also remove them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { Button, buttonClasses } from "@haruhimemoe/ui";
import Link from "next/link";
import { useId, useState } from "react";
import { PacksApiError } from "@/lib/packs-api";
import type { PackExport } from "@/schemas/pack-export";
import { formatShortDate } from "@/utils/date";
import { canonicalLinks, infohashOf } from "@/utils/magnet";

type MagnetLinksProps = {
  exports: readonly PackExport[];
  /** The owner, or an admin. */
  onRemove?: (url: string) => Promise<void>;
};

export function MagnetLinks({ exports, onRemove }: MagnetLinksProps) {
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const headingId = useId();

  // The server already sends canonical links; this keeps anything else out of an href regardless.
  const links = canonicalLinks(exports);
  if (links.length === 0) return null;

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("Magnet link copied.");
    } catch {
      setStatus("Couldn't copy. Use Open, or copy the link by hand.");
    }
  };

  const remove = async (url: string) => {
    if (!onRemove) return;
    setRemoving(url);
    setError(null);
    try {
      await onRemove(url);
      setConfirming(null);
    } catch (cause) {
      setError(cause instanceof PacksApiError ? cause.message : "Couldn't remove it. Try again.");
    } finally {
      setRemoving(null);
    }
  };

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
        <Link href="/guide/download-a-torrent" className="text-h1 underline hover:text-c1">
          How to download with a torrent
        </Link>
      </p>
      <ul className="flex flex-col gap-3">
        {links.map((entry) => {
          const short = (infohashOf(entry.url) ?? "").slice(0, 8);
          return (
            <li key={entry.url} className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-c2 text-sm">{short}</span>
              <span className="text-c3 text-sm">Added {formatShortDate(entry.createdAt)}</span>
              {confirming === entry.url ? (
                <>
                  <span className="text-c3 text-sm">
                    Remove this link? Anyone using it can't find it here after.
                  </span>
                  <Button
                    variant="ghost"
                    onClick={() => setConfirming(null)}
                    disabled={removing !== null}
                  >
                    Keep it
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => remove(entry.url)}
                    disabled={removing !== null}
                  >
                    Yes, remove
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    variant="secondary"
                    aria-label={`Copy magnet link ${short}`}
                    onClick={() => copy(entry.url)}
                  >
                    Copy magnet link
                  </Button>
                  <a
                    href={entry.url}
                    aria-label={`Open magnet link ${short}`}
                    className={buttonClasses({ variant: "secondary" })}
                  >
                    Open
                  </a>
                  {onRemove ? (
                    <Button
                      variant="ghost"
                      aria-label={`Remove magnet link ${short}`}
                      onClick={() => setConfirming(entry.url)}
                      disabled={removing !== null}
                    >
                      Remove
                    </Button>
                  ) : null}
                </>
              )}
            </li>
          );
        })}
      </ul>
      <output className="block text-c3 text-sm">{status}</output>
      {error ? (
        <p role="alert" className="font-bold text-rose-300 text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
