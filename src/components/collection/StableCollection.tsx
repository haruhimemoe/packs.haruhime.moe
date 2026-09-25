/**
 * @file src/components/collection/StableCollection.tsx
 * @desc The osu!stable side of "Add to osu! collection": pick your collection.db (read in this
 *       tab, not uploaded or kept), choose one of its collections or name a new one, see what
 *       changes, then download the whole file with the pack's maps added. Read and name errors
 *       show the package's code; a good read is announced. The input is locked while a file
 *       reads. After a download the edited file stays loaded, so a second add builds on the
 *       first. A focused control that disables or removes itself hands focus on instead of
 *       dropping it to the page: the file input gets it back after a read, and the Download and
 *       "instead" buttons pass it to the Collection select.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

"use client";

import {
  addToCollection,
  COLLECTION_DB_FILENAME,
  type CollectionDb,
  CollectionDbError,
  type CollectionDbRead,
} from "@haruhimemoe/osu/collections";
import { Button, Notice, Select, TextInput } from "@haruhimemoe/ui";
import { type ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
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

/**
 * What the reader found odd: entries it kept, empty map entries (0x00 hashes) it dropped, and
 * whether it stopped listing. Warnings past its first 1,000 come without a code, so they count
 * as kept and the text allows for empty map entries among them.
 */
type Unusual = { kept: number; dropped: number; unlisted: boolean };
type Loaded = { db: CollectionDb; unusual: Unusual };
type Added = ReturnType<typeof addToCollection>;
type Preview = { kind: "error"; message: string } | ({ kind: "ok" } & Added);

const countMaps = (n: number): string => `${n} ${n === 1 ? "map" : "maps"}`;
const countCollections = (n: number): string => `${n} ${n === 1 ? "collection" : "collections"}`;
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

const unusualOf = (read: CollectionDbRead): Unusual => {
  const dropped = read.warnings.filter((warning) => warning.code === "null_hash").length;
  return {
    kept: read.warnings.length - dropped + read.omittedWarnings,
    dropped,
    unlisted: read.omittedWarnings > 0,
  };
};

const unusualText = ({ kept, dropped, unlisted }: Unusual): string => {
  const sentences: string[] = [];
  if (kept > 0) {
    const one = kept === 1;
    const fate = unlisted
      ? "packs keeps them, apart from any empty map entries."
      : `packs keeps ${one ? "it" : "them"}.`;
    sentences.push(
      `${kept} ${one ? "entry in this file looks" : "entries in this file look"} unusual, like a map listed twice. ${fate}`,
    );
  }
  if (dropped > 0) {
    sentences.push(
      dropped === 1
        ? "1 map entry in this file is empty. packs leaves it out of the new file."
        : `${dropped} map entries in this file are empty. packs leaves them out of the new file.`,
    );
  }
  return sentences.join(" ");
};

const saveErrorText = (error: unknown): string =>
  error instanceof CollectionDbError
    ? collectionErrorText(error)
    : "Couldn't save collection.db. Try again.";

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
  const fileRef = useRef<HTMLInputElement>(null);
  const collectionRef = useRef<HTMLSelectElement>(null);
  const refocusFile = useRef(false);

  // Locking the file input while it has focus sends focus to <body> in browsers that apply the
  // focus fix-up rule. Once a read ends and it's unlocked, put focus back there, unless focus has
  // moved on to something else.
  useEffect(() => {
    if (reading || !refocusFile.current) return;
    refocusFile.current = false;
    const active = document.activeElement;
    if (active === null || active === document.body) fileRef.current?.focus();
  }, [reading]);

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
        unusual: unusualOf(read),
      });
      setPicked(NEW);
      setStatus(`Read collection.db: ${countCollections(read.collections.length)}.`);
    } catch (error) {
      setLoaded(null);
      setReadError(collectionErrorText(error));
    } finally {
      refocusFile.current = true;
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
      setSaveError(saveErrorText(error));
      return;
    }
    setSaveError(null);
    // Keep the edited file: a second add builds on this one.
    setLoaded({ db: preview.db, unusual: loaded.unusual });
    setPicked(String(preview.index));
    setStatus(
      `Downloaded collection.db with ${countMaps(preview.added)} added to "${shown(name)}".`,
    );
    // Everything is in that collection now, so the button disables itself: move on from it.
    collectionRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        ref={fileRef}
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
      {loaded && (loaded.unusual.kept > 0 || loaded.unusual.dropped > 0) ? (
        <Notice>{unusualText(loaded.unusual)}</Notice>
      ) : null}
      {loaded ? (
        <>
          <Select
            ref={collectionRef}
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
              hint="Case counts, and so do spaces inside the name. A name you already have adds to that collection."
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
          {hashes === null ? (
            <p className="text-c3 text-sm">The preview shows once every map's info has loaded.</p>
          ) : null}
          {preview?.kind === "ok" ? (
            <p className="text-c2 text-sm">{previewText(preview, name)}</p>
          ) : null}
          {preview?.kind === "ok" && preview.similarName !== null ? (
            <div className="flex flex-col items-start gap-2">
              <Notice tone="warning">
                {`You already have "${shown(preview.similarName)}". Case and spaces count, so this makes a second collection.`}
              </Notice>
              {similarIndex >= 0 ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    // This button goes away with the pick, so focus goes where the pick shows.
                    pick(String(similarIndex));
                    collectionRef.current?.focus();
                  }}
                >
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
