/**
 * @file src/components/collection/LazerCollection.tsx
 * @desc The osu!lazer side of "Add to osu! collection": the collection's name as it shows in lazer
 *       (used exactly as typed; empty refused, outer spaces warned about), then a zip holding a
 *       collection.db with just this pack's maps and an empty osu!.import.cfg, for the setup
 *       wizard's import from a previous osu! install, with the steps. Desktop only. A name the
 *       zip can't hold shows the package's code.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

"use client";

import { CollectionDbError } from "@haruhimemoe/osu/collections";
import { Button, Notice, TextInput } from "@haruhimemoe/ui";
import { useId, useState } from "react";
import { lazerCollectionZip } from "@/lib/collections/collection-files";
import { collectionErrorText, defaultCollectionName, lazerZipName } from "@/utils/osu-collection";

export type LazerCollectionProps = {
  /** The pack's name, for the default collection name and the zip's name. */
  packName: string;
  /** The pack's MD5s, or null while the map info isn't ready. */
  hashes: readonly string[] | null;
  /** Saves a file from the click (the card passes downloadBlob). */
  download: (blob: Blob, filename: string) => void;
};

const countMaps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;

// lazer takes a tab or a line break in a name, so the only name the zip refuses is one UTF-8
// can't encode: a lone surrogate, usually half of an emoji.
const zipErrorText = (error: unknown): string => {
  if (!(error instanceof CollectionDbError)) return "Couldn't save the zip. Try again.";
  if (error.code === "invalid_name") {
    return `That name has a broken character, like half of an emoji (${error.code}).`;
  }
  return collectionErrorText(error);
};

export function LazerCollection({ packName, hashes, download }: LazerCollectionProps) {
  const id = useId();
  const [typedName, setTypedName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Exactly as typed: lazer matches names exactly, so "Farm " and "Farm" are two collections.
  const name = typedName ?? defaultCollectionName(packName);
  const empty = name.trim() === "";
  const padded = !empty && name !== name.trim();
  const count = hashes?.length ?? 0;
  const zipName = lazerZipName(packName);

  const onDownload = () => {
    if (hashes === null || hashes.length === 0 || empty) return;
    try {
      download(lazerCollectionZip(name, hashes), zipName);
    } catch (caught) {
      setError(zipErrorText(caught));
      setStatus("");
      return;
    }
    setError(null);
    setStatus(`Downloaded ${zipName}. Follow the steps above to import it.`);
  };

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        id={`${id}-name`}
        label="Collection name in osu!lazer"
        value={name}
        hint="Type it exactly as it shows in lazer. Case and spaces count: any other name makes a new collection."
        error={empty ? "Type a collection name." : undefined}
        onChange={(event) => {
          setTypedName(event.currentTarget.value);
          setStatus("");
          setError(null);
        }}
      />
      {padded ? (
        <Notice tone="warning">
          This name starts or ends with a space. lazer treats it as a different collection from the
          same name without the space.
        </Notice>
      ) : null}
      {count > 0 && !empty ? (
        <p className="text-c2 text-sm">
          {`Adds ${countMaps(count)} to "${name}". Maps already in it are skipped.`}
        </p>
      ) : null}
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-bold text-c1">Then, in osu!lazer:</p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-c2">
          <li>
            Extract the zip. You get one folder holding collection.db and an empty osu!.import.cfg.
          </li>
          <li>
            Open Settings, then General, and press "Run setup wizard". Press Next until you reach
            the Import step.
          </li>
          <li>
            Choose the extracted folder as the previous osu! install, or drag the folder onto the
            osu! window. If osu!stable is installed, the field already points at it: change it.
          </li>
          <li>Untick Beatmaps, Scores and Skins, leave Collections ticked, and press Import.</li>
          <li>
            Wait until lazer says it imported the collections. Maps you don't have yet show up once
            you download them.
          </li>
        </ol>
        <p className="text-c3">
          This works on desktop only. osu!lazer on Android and iOS can't import collections.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onDownload} disabled={count === 0 || empty}>
          Download zip for osu!lazer
        </Button>
      </div>
      <Notice live>{status}</Notice>
      {error ? (
        <Notice live tone="error">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
