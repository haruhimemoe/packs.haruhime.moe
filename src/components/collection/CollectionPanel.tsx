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
 * @modified Sat Sep 26, 2026
 */

"use client";

import { Card, Notice } from "@haruhimemoe/ui";
import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { LazerCollection } from "@/components/collection/LazerCollection";
import { StableCollection } from "@/components/collection/StableCollection";
import type { MetaState } from "@/hooks/beatmapMetaState";
import { downloadBlob } from "@/lib/zip/save-zip";
import type { Pool } from "@/schemas/pack";
import { collectionMaps, type SkippedMap } from "@/utils/osu-collection";

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
    description: "Load your collection.db and download it back with the maps added.",
  },
  {
    value: "lazer",
    label: "osu!lazer",
    description: "Download a zip that lazer's setup wizard imports.",
  },
] as const;
type Client = (typeof CLIENTS)[number]["value"];

const REASONS: Record<SkippedMap["reason"], string> = {
  missing: "not found on the mirror or osu!",
  "no-checksum": "no checksum in its map info",
};

const countMaps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;

export function CollectionPanel({ pack, getMeta, download = downloadBlob }: CollectionPanelProps) {
  const maps = useMemo(() => collectionMaps(pack, getMeta), [pack, getMeta]);
  const hashes = maps.status === "ready" ? maps.hashes : null;
  // No map can go in a collection: only the message (and why) shows, no client choice or sides.
  const nothingToAdd = maps.status === "ready" && maps.hashes.length === 0;
  const [client, setClient] = useState<Client>("stable");
  const clientGroup = useId();

  return (
    <Card title="Add to osu! collection">
      <div className="flex flex-col gap-4">
        <p className="text-c3 text-sm">
          Put this pack's maps in one of your osu! collections.{" "}
          <Link href="/guide/osu-collections" className="text-h1 underline hover:text-c1">
            How it works
          </Link>
        </p>
        {maps.status === "loading" ? <p className="text-c3 text-sm">Loading map info…</p> : null}
        {maps.status === "error" ? (
          <Notice tone="error">
            {`Map info didn't load for ${countMaps(maps.failed)}. Retry loading maps in the Download card first.`}
          </Notice>
        ) : null}
        {maps.status === "ready" && maps.skipped.length > 0 ? (
          <Notice tone="warning" as="div">
            <p>
              {`${countMaps(maps.skipped.length)} can't go in a collection and ${maps.skipped.length === 1 ? "is" : "are"} left out:`}
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
          <p className="text-c3 text-sm">
            None of these maps can go in a collection, so there's nothing to add.
          </p>
        ) : null}
        {/* Hidden, not unmounted, so a loaded file or a typed name survives a pool that empties
            and fills again. */}
        <div hidden={nothingToAdd} className="flex flex-col gap-4">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-bold text-c3 text-sm">Which osu! do you play?</legend>
            {CLIENTS.map((option) => (
              <label key={option.value} className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  name={clientGroup}
                  value={option.value}
                  checked={client === option.value}
                  onChange={() => setClient(option.value)}
                  className="mt-1 accent-h1"
                />
                <span>
                  <span className="font-bold text-c1">{option.label}</span>
                  <span className="text-c3"> · {option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
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
