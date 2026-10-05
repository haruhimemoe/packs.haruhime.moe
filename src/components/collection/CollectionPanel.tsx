/**
 * @file src/components/collection/CollectionPanel.tsx
 * @desc The "Add to osu! collection" card on /new, /k and /p/[slug], with a link to the guide: the
 *       pack's difficulty MD5s from the map info the page already loaded (waiting while it loads,
 *       pointing at the Download card's retry when it failed, listing the maps it leaves out),
 *       then a choice of osu!stable (edit your collection.db) or osu!lazer (a zip for its setup
 *       wizard). Both sides stay mounted, so switching keeps a loaded file or a typed name. When
 *       no map can go in a collection, the choice and both sides are hidden: only that message
 *       and the maps left out show. Downloads are plain browser downloads started by the click.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sun Oct 4, 2026
 */

"use client";

import { Card, Notice, RadioGroup, Text, TextLink } from "@haruhimemoe/ui";
import { useMemo, useState } from "react";
import { LazerCollection } from "@/components/collection/LazerCollection";
import { StableCollection } from "@/components/collection/StableCollection";
import { downloadBlob } from "@/lib/zip/save-zip";
import type { MetaState } from "@/schemas/beatmap-meta";
import type { Pool } from "@/schemas/pack";
import { collectionMaps, type SkippedMap } from "@/utils/osu-collection";
import { countOf } from "@/utils/text";

export type CollectionPanelProps = {
  pack: Pool;
  getMeta: (beatmapId: number) => MetaState;
  /** Test seam. Default: a normal browser download started by the click. */
  download?: (blob: Blob, filename: string) => void;
};

const CLIENTS = [
  {
    value: "stable",
    label: "osu!stable",
    hint: "Load your collection.db and download it back with the maps added.",
  },
  {
    value: "lazer",
    label: "osu!lazer",
    hint: "Download a zip that lazer's setup wizard imports.",
  },
] as const;
type Client = (typeof CLIENTS)[number]["value"];

const REASONS: Record<SkippedMap["reason"], string> = {
  missing: "not found on the mirror or osu!",
  "no-checksum": "no checksum in its map info",
};

/**
 * @function CollectionPanel
 * @param props {CollectionPanelProps} pack, getMeta, download
 * @returns {JSX.Element} the "Add to osu! collection" card on /new, /k and /p/[slug], with a link
 *          to the guide
 */
export function CollectionPanel({ pack, getMeta, download = downloadBlob }: CollectionPanelProps) {
  const maps = useMemo(() => collectionMaps(pack, getMeta), [pack, getMeta]);
  const hashes = maps.status === "ready" ? maps.hashes : null;
  // No map can go in a collection: only the message (and why) shows, no client choice or sides.
  const nothingToAdd = maps.status === "ready" && maps.hashes.length === 0;
  const [client, setClient] = useState<Client>("stable");

  return (
    <Card title="Add to osu! collection">
      <div className="flex flex-col gap-4">
        <Text tone="muted">
          Put this pack's maps in one of your osu! collections.{" "}
          <TextLink href="/guides/osu-collections">How it works</TextLink>
        </Text>
        {maps.status === "loading" ? <Text tone="muted">Loading map info…</Text> : null}
        {maps.status === "error" ? (
          <Notice tone="error">
            {`Map info didn't load for ${countOf(maps.failed, "map")}. Retry loading maps in the Download card first.`}
          </Notice>
        ) : null}
        {maps.status === "ready" && maps.skipped.length > 0 ? (
          <Notice tone="warning" as="div">
            <p>
              {`${countOf(maps.skipped.length, "map")} can't go in a collection and ${maps.skipped.length === 1 ? "is" : "are"} left out:`}
            </p>
            <ul className="list-disc pl-5">
              {maps.skipped.map((map) => (
                <li key={`${map.label} ${map.beatmapId}`}>
                  {`${map.label} (beatmap ${map.beatmapId}): ${REASONS[map.reason]}`}
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}
        {nothingToAdd ? (
          <Text tone="muted">
            None of these maps can go in a collection, so there's nothing to add.
          </Text>
        ) : null}
        {/* Hidden, not unmounted, so a loaded file or a typed name survives a pool that empties
            and fills again. */}
        <div hidden={nothingToAdd} className="flex flex-col gap-4">
          <RadioGroup
            label="Which osu! do you play?"
            options={CLIENTS}
            value={client}
            onChange={(next) => setClient(next as Client)}
          />
          <div hidden={client !== "stable"}>
            <StableCollection
              packName={pack.name}
              hashes={hashes}
              mapInfoFailed={maps.status === "error"}
              download={download}
            />
          </div>
          <div hidden={client !== "lazer"}>
            <LazerCollection packName={pack.name} hashes={hashes} download={download} />
          </div>
        </div>
      </div>
    </Card>
  );
}
