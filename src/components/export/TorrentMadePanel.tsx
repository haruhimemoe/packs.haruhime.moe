/**
 * @file src/components/export/TorrentMadePanel.tsx
 * @desc A made torrent: Save .torrent, the magnet link on @haruhimemoe/ui's CopyField, for a saved
 *       pack's owner a button (after Copy) that lists the link on the pack, and how to seed it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { Button, CopyField, Notice, Text, TextLink } from "@haruhimemoe/ui";
import { useState } from "react";
import { PacksApiError } from "@/lib/packs-api";
import type { BuiltTorrent } from "@/lib/torrent/build-torrent";
import { infohashOf } from "@/utils/magnet";

/** A saved pack's magnet links, and how its owner adds one. */
export type MagnetTarget = {
  added: readonly string[];
  add: (magnet: string) => Promise<void>;
};

type TorrentMadePanelProps = {
  built: BuiltTorrent;
  /** The pack's folder name, which the seeding steps point at. */
  folder: string;
  onSave: () => void;
  /** Only for the owner of a saved pack. */
  magnets?: MagnetTarget | undefined;
};

type AddState = { phase: "idle" } | { phase: "adding" } | { phase: "error"; message: string };

/**
 * @function TorrentMadePanel
 * @param props {TorrentMadePanelProps} the torrent, its folder, how to save it, and the pack's
 *        magnet links when the owner is looking
 * @returns {JSX.Element} the save, copy and add controls and the seeding note
 */
export function TorrentMadePanel({ built, folder, onSave, magnets }: TorrentMadePanelProps) {
  const [adding, setAdding] = useState<AddState>({ phase: "idle" });
  const alreadyAdded = (magnets?.added ?? []).some((url) => infohashOf(url) === built.infoHash);

  const add = async (target: MagnetTarget) => {
    setAdding({ phase: "adding" });
    try {
      await target.add(built.magnet);
      setAdding({ phase: "idle" });
    } catch (cause) {
      const message =
        cause instanceof PacksApiError ? cause.message : "Couldn't add the magnet link. Try again.";
      setAdding({ phase: "error", message });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onSave}>Save .torrent</Button>
      </div>
      <CopyField
        label="Magnet link"
        value={built.magnet}
        copyLabel="Copy magnet link"
        copiedMessage="Magnet link copied."
        failedMessage="Couldn't copy. Select the link and copy it by hand."
        actions={
          magnets ? (
            <Button
              variant="secondary"
              onClick={() => add(magnets)}
              disabled={alreadyAdded || adding.phase === "adding"}
            >
              {alreadyAdded
                ? "Magnet link added"
                : adding.phase === "adding"
                  ? "Adding…"
                  : "Add magnet link to this pack"}
            </Button>
          ) : undefined
        }
      />
      {adding.phase === "error" ? (
        <Notice tone="error" live className="font-bold">
          {adding.message}
        </Notice>
      ) : null}
      <Text tone="muted">
        A torrent only works while someone seeds it. Save the .zip too, unzip it, then open the
        .torrent in qBittorrent and set its save location to the folder that holds “{folder}”. It
        checks the files and starts seeding.{" "}
        <TextLink href="/guides/seed-a-torrent">Seeding guide</TextLink>
      </Text>
    </div>
  );
}
