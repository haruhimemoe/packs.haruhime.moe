/**
 * @file src/components/collection/StableCollection.tsx
 * @desc The osu!stable side of "Add to osu! collection": pick your collection.db (read in this
 *       tab, not uploaded or kept), choose one of its collections or name a new one, see what
 *       changes, then download the whole file with the pack's maps added. Read and name errors
 *       show the package's code. The input is locked while a file reads. After a download the
 *       edited file stays loaded, so a second add builds on the first.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

"use client";

import {
  addToCollection,
  COLLECTION_DB_FILENAME,
  type CollectionDb,
  type CollectionDbRead,
} from "@haruhimemoe/osu/collections";
import { Button, Notice, Select, TextInput } from "@haruhimemoe/ui";
import { type ChangeEvent, useId, useMemo, useState } from "react";
import { readCollectionFile, stableCollectionFile } from "@/lib/collections/collection-files";
import { collectionErrorText, defaultCollectionName } from "@/utils/osu-collection";

/** The Select's value for "New collection". Existing collections use their index. */
const NEW = "new";
const FILE_HINT =
  "It's in your osu! folder, next to osu!.db (on Windows, usually %LOCALAPPDATA%\\osu!). packs reads it in this tab. It isn't uploaded or saved.";

export type StableCollectionProps = {
  /** The pack's name, for a new collection's default name. */
  packName: string;
  /** The pack's MD5s, or null while the map info isn't ready. */
  hashes: readonly string[] | null;
  /** Saves a file from the click (the card passes downloadBlob). */
  download: (blob: Blob, filename: string) => void;
  /** Test seam. Default: readCollectionFile. */
  readFile?: (file: Blob) => Promise<CollectionDbRead>;
};

type Loaded = { db: CollectionDb; unusual: number };
type Added = ReturnType<typeof addToCollection>;
type Preview = { kind: "error"; message: string } | ({ kind: "ok" } & Added);

const countMaps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;
const shown = (name: string): string => (name === "" ? "(no name)" : name);

const previewText = (added: Added, name: string): string => {
  const quoted = `"${shown(name)}"`;
  if (added.created) return `Makes a new collection ${quoted} with ${countMaps(added.added)}.`;
  if (added.added === 0) return `All of these maps are already in ${quoted}.`;
  const already =
    added.alreadyPresent === 0
      ? ""
      : ` ${added.alreadyPresent} ${added.alreadyPresent === 1 ? "is" : "are"} already in it.`;
  return `Adds ${countMaps(added.added)} to ${quoted}.${already}`;
};

const unusualText = (n: number): string =>
  `${n} ${n === 1 ? "entry in this file looks" : "entries in this file look"} unusual, like a map listed twice. They stay exactly as they are.`;

export function StableCollection({
  packName,
  hashes,
  download,
  readFile = readCollectionFile,
}: StableCollectionProps) {
  const id = useId();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [picked, setPicked] = useState(NEW);
  const [typedName, setTypedName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    setReading(true);
    setReadError(null);
    setStatus("");
    setSaveError(null);
    try {
      const read = await readFile(file);
      setLoaded({
        db: { version: read.version, collections: read.collections },
        unusual: read.warnings.length + read.omittedWarnings,
      });
      setPicked(NEW);
    } catch (error) {
      setLoaded(null);
      setReadError(collectionErrorText(error));
    } finally {
      setReading(false);
    }
  };

  // A name that repeats in the file is listed once: adding goes to its first collection.
  const options = useMemo(() => {
    const seen = new Set<string>();
    return (loaded?.db.collections ?? []).flatMap((collection, index) => {
      if (seen.has(collection.name)) return [];
      seen.add(collection.name);
      return [{ value: String(index), name: collection.name, count: collection.hashes.length }];
    });
  }, [loaded]);

  const existingName =
    loaded && picked !== NEW ? (loaded.db.collections[Number(picked)]?.name ?? null) : null;
  const typedOrDefault = typedName ?? defaultCollectionName(packName);
  const name = existingName ?? typedOrDefault.trim();

  const preview = useMemo((): Preview | null => {
    if (!loaded || !hashes || hashes.length === 0) return null;
    if (existingName === null && name === "") {
      return { kind: "error", message: "Type a name for the new collection." };
    }
    try {
      return { kind: "ok", ...addToCollection(loaded.db, name, hashes) };
    } catch (error) {
      return { kind: "error", message: collectionErrorText(error) };
    }
  }, [loaded, hashes, existingName, name]);

  const similarIndex =
    preview?.kind === "ok" && preview.similarName !== null && loaded
      ? loaded.db.collections.findIndex((collection) => collection.name === preview.similarName)
      : -1;

  const pick = (value: string) => {
    setPicked(value);
    setStatus("");
  };

  const onDownload = () => {
    if (preview?.kind !== "ok" || !loaded) return;
    try {
      download(stableCollectionFile(preview.db), COLLECTION_DB_FILENAME);
    } catch (error) {
      setSaveError(collectionErrorText(error));
      return;
    }
    setSaveError(null);
    // Keep the edited file: a second add builds on this one.
    setLoaded({ db: preview.db, unusual: loaded.unusual });
    setPicked(String(preview.index));
    setStatus(
      `Downloaded collection.db with ${countMaps(preview.added)} added to "${shown(name)}".`,
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        id={`${id}-file`}
        type="file"
        accept=".db"
        label="Your collection.db"
        hint={FILE_HINT}
        error={readError ?? undefined}
        disabled={reading}
        onChange={onFile}
      />
      {reading ? <p className="text-c3 text-sm">Reading collection.db…</p> : null}
      {loaded && loaded.unusual > 0 ? <Notice>{unusualText(loaded.unusual)}</Notice> : null}
      {loaded ? (
        <>
          <Select
            id={`${id}-collection`}
            label="Collection"
            value={picked}
            onChange={(event) => pick(event.currentTarget.value)}
          >
            <option value={NEW}>New collection</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {`${shown(option.name)} (${countMaps(option.count)})`}
              </option>
            ))}
          </Select>
          {picked === NEW ? (
            <TextInput
              id={`${id}-name`}
              label="Name"
              value={typedOrDefault}
              hint="Case and spaces count. A name you already have adds to that collection."
              error={preview?.kind === "error" ? preview.message : undefined}
              onChange={(event) => {
                setTypedName(event.currentTarget.value);
                setStatus("");
              }}
            />
          ) : null}
          {picked !== NEW && preview?.kind === "error" ? (
            <Notice tone="error">{preview.message}</Notice>
          ) : null}
          {hashes === null ? <p className="text-c3 text-sm">Waiting for map info…</p> : null}
          {preview?.kind === "ok" ? (
            <p className="text-c2 text-sm">{previewText(preview, name)}</p>
          ) : null}
          {preview?.kind === "ok" && preview.similarName !== null ? (
            <div className="flex flex-col items-start gap-2">
              <Notice tone="warning">
                {`You already have "${shown(preview.similarName)}". Case and spaces count, so this makes a second collection.`}
              </Notice>
              {similarIndex >= 0 ? (
                <Button variant="secondary" onClick={() => pick(String(similarIndex))}>
                  {`Add to "${shown(preview.similarName)}" instead`}
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-bold text-c1">Then, to use it:</p>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-c2">
              <li>
                Close osu! first. It reads collection.db when it starts and saves its own copy
                later, so it ignores a file swapped while it runs, then overwrites it.
              </li>
              <li>Keep a copy of your old collection.db.</li>
              <li>
                Put the new file in your osu! folder, named exactly collection.db. If your browser
                saved it as collection (1).db, rename it.
              </li>
              <li>Start osu!.</li>
            </ol>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onDownload} disabled={preview?.kind !== "ok" || preview.added === 0}>
              Download collection.db
            </Button>
          </div>
        </>
      ) : null}
      <Notice live>{status}</Notice>
      {saveError ? (
        <Notice live tone="error">
          {saveError}
        </Notice>
      ) : null}
    </div>
  );
}
