/**
 * @file src/components/collection/StableCollection.tsx
 * @desc The osu!stable side of "Add to osu! collection": close osu!, pick your collection.db
 *       (read in this tab, not uploaded or kept), choose one of its collections or name a new
 *       one, see what changes, then download the whole file with the pack's maps added. Read,
 *       name and save errors show the package's code; a good read is announced. The input is
 *       locked while a file reads and cleared after each pick, so the same file can be picked
 *       again. The list shows at most MAX_LISTED_COLLECTIONS names, clipped when very long; a
 *       typed exact name (outer spaces and all) reaches the rest, and any other typed name loses
 *       its outer spaces. Until the map info is ready the preview waits, or points at the retry
 *       when it failed. The Download button is described by the preview and any similar-name
 *       warning; with nothing left to add it goes aria-disabled, not disabled, so it stays
 *       reachable and says why. After a download the edited file stays loaded, so a second add
 *       builds on the first. A focused control that disables or removes itself hands focus on
 *       instead of dropping it to the page: the file input gets it back after a read, and the
 *       "instead" button passes it to the Collection select. Names wrap anywhere on a phone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sat Sep 26, 2026
 */

"use client";

import {
  addToCollection,
  COLLECTION_DB_FILENAME,
  type CollectionDb,
  CollectionDbError,
  type CollectionDbRead,
  MAX_COLLECTION_DB_BYTES,
} from "@haruhimemoe/osu/collections";
import { Button, Notice, Select, TextInput } from "@haruhimemoe/ui";
import { type ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { readCollectionFile, stableCollectionFile } from "@/lib/collections/collection-files";
import {
  collectionErrorText,
  collectionLabel,
  collectionOptions,
  defaultCollectionName,
} from "@/utils/osu-collection";

/** The Select's value for "New collection". Existing collections use their index. */
const NEW = "new";
const FILE_HINT =
  "Close osu! first, so the file has your latest changes. It's in your osu! folder, next to osu!.db (on Windows, usually %LOCALAPPDATA%\\osu!). packs reads it in this tab. It isn't uploaded or saved.";

export type StableCollectionProps = {
  /** The pack's name, for a new collection's default name. */
  packName: string;
  /** The pack's MD5s, or null while the map info isn't ready. */
  hashes: readonly string[] | null;
  /** True when some map info failed to load (hashes is null then), so it points at the retry. */
  mapInfoFailed?: boolean;
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

const previewText = (added: Added, name: string): string => {
  const quoted = `"${collectionLabel(name)}"`;
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

const MAX_MIB = MAX_COLLECTION_DB_BYTES / (1024 * 1024);

const saveErrorText = (error: unknown): string => {
  if (!(error instanceof CollectionDbError)) return "Couldn't save collection.db. Try again.";
  // Writing, too_large means the edited file, not the one picked: the read would have refused it.
  if (error.code === "too_large") {
    return `With these maps, collection.db would be over ${MAX_MIB} MiB, more than packs writes (${error.code}).`;
  }
  return collectionErrorText(error);
};

const unlistedHint = (unlisted: number): string =>
  `Your file has ${unlisted} more ${unlisted === 1 ? "collection" : "collections"} than this list shows. To add to one of them, pick New collection and type its exact name.`;

export function StableCollection({
  packName,
  hashes,
  mapInfoFailed = false,
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
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    // Clear the pick, so picking the same file again (say, after a read error) still fires change.
    input.value = "";
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
  const { options, unlisted } = useMemo(
    () => collectionOptions(loaded?.db.collections ?? []),
    [loaded],
  );
  const listed = useMemo(() => new Set(options.map((option) => option.value)), [options]);

  const existingName =
    loaded && picked !== NEW ? (loaded.db.collections[Number(picked)]?.name ?? null) : null;
  const names = useMemo(
    () => new Set(loaded?.db.collections.map((collection) => collection.name)),
    [loaded],
  );
  const typedOrDefault = typedName ?? defaultCollectionName(packName);
  // A typed name that is exactly one in the file, outer spaces and all, adds to that collection:
  // that's how an unlisted one with outer spaces is reached. Otherwise outer spaces are dropped,
  // since a new name can't have them.
  const name = existingName ?? (names.has(typedOrDefault) ? typedOrDefault : typedOrDefault.trim());

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
  // Only a listed collection can be picked; an unlisted one is reached by typing its name.
  const similarListed = listed.has(String(similarIndex));

  const previewId = `${id}-preview`;
  const similarId = `${id}-similar`;
  const showSimilar = preview?.kind === "ok" && preview.similarName !== null;
  // The Download button reads out what it does and any similar-name warning.
  const downloadDescribedBy =
    [preview?.kind === "ok" ? previewId : null, showSimilar ? similarId : null]
      .filter(Boolean)
      .join(" ") || undefined;
  // Nothing to add: the button stays focusable (aria-disabled, not disabled), so keyboard and
  // screen reader users still reach it and hear why.
  const nothingToAdd = preview?.kind === "ok" && preview.added === 0;

  const pick = (value: string) => {
    setPicked(value);
    setStatus("");
  };

  const onDownload = () => {
    if (preview?.kind !== "ok" || preview.added === 0 || !loaded) return;
    try {
      download(stableCollectionFile(preview.db), COLLECTION_DB_FILENAME);
    } catch (error) {
      setSaveError(saveErrorText(error));
      return;
    }
    setSaveError(null);
    // Keep the edited file: a second add builds on this one. Pick the collection when the list
    // shows it (a new one lands at the end, past a full list); otherwise the typed name stays,
    // and it now names that collection.
    const next = collectionOptions(preview.db.collections).options;
    const index = String(preview.index);
    setLoaded({ db: preview.db, unusual: loaded.unusual });
    setPicked(next.some((option) => option.value === index) ? index : NEW);
    setStatus(
      `Downloaded collection.db with ${countMaps(preview.added)} added to "${collectionLabel(name)}". Now swap it in: the steps are above.`,
    );
    // Everything is in that collection now, so the button goes aria-disabled and keeps focus.
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
            hint={unlisted > 0 ? unlistedHint(unlisted) : undefined}
            onChange={(event) => pick(event.currentTarget.value)}
          >
            <option value={NEW}>New collection</option>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            <p className="text-c3 text-sm">
              {mapInfoFailed
                ? `Some map info didn't load. Press "Retry loading maps" in the Download card, and the preview shows once it has.`
                : "The preview shows once every map's info has loaded."}
            </p>
          ) : null}
          {preview?.kind === "ok" ? (
            <p id={previewId} className="wrap-anywhere text-c2 text-sm">
              {previewText(preview, name)}
            </p>
          ) : null}
          {preview?.kind === "ok" && preview.similarName !== null ? (
            <div className="flex flex-col items-start gap-2">
              <Notice id={similarId} tone="warning" className="wrap-anywhere">
                {`You already have "${collectionLabel(preview.similarName)}". Case and spaces count, so this makes a second collection.`}
              </Notice>
              {similarListed ? (
                <Button
                  variant="secondary"
                  className="wrap-anywhere h-auto min-h-9 py-1.5"
                  onClick={() => {
                    // This button goes away with the pick, so focus goes where the pick shows.
                    pick(String(similarIndex));
                    collectionRef.current?.focus();
                  }}
                >
                  {`Add to "${collectionLabel(preview.similarName)}" instead`}
                </Button>
              ) : null}
            </div>
          ) : null}
          <div className="flex flex-col gap-1 text-sm">
            <p className="font-bold text-c1">Then, to use it:</p>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-c2">
              <li>
                Keep osu! closed until the new file is in place. It reads collection.db when it
                starts and saves its own copy later, so it ignores a file swapped while it runs,
                then overwrites it.
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
            <Button
              onClick={onDownload}
              disabled={preview?.kind !== "ok"}
              aria-disabled={nothingToAdd || undefined}
              aria-describedby={downloadDescribedBy}
              className="aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
            >
              Download collection.db
            </Button>
          </div>
        </>
      ) : null}
      <Notice live className="wrap-anywhere">
        {status}
      </Notice>
      {saveError ? (
        <Notice live tone="error">
          {saveError}
        </Notice>
      ) : null}
    </div>
  );
}
