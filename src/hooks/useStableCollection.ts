/**
 * @file src/hooks/useStableCollection.ts
 * @desc The osu!stable collection card's state: the loaded collection.db (read in this tab, never
 *       sent or kept), the picked or typed collection, the preview of adding the pack's maps, the
 *       download, and focus handed back to the file input after a read. StableCollection renders
 *       what it returns.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import {
  addToCollection,
  COLLECTION_DB_FILENAME,
  type CollectionDbRead,
} from "@haruhimemoe/osu/collections";
import { type ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { stableCollectionFile } from "@/lib/collections/collection-files";
import {
  collectionErrorText,
  collectionLabel,
  collectionOptions,
  defaultCollectionName,
} from "@/utils/osu-collection";
import {
  type Loaded,
  type Preview,
  saveErrorText,
  unusualOf,
} from "@/utils/stable-collection-text";
import { countOf } from "@/utils/text";

/** The Select's value for "New collection". Existing collections use their index. */
export const NEW = "new";

type StableCollectionInput = {
  packName: string;
  hashes: readonly string[] | null;
  download: (blob: Blob, filename: string) => void;
  readFile: (file: Blob) => Promise<CollectionDbRead>;
};

/**
 * @function useStableCollection
 * @param input {StableCollectionInput} the pack's name and hashes, how to save, how to read
 * @returns {object} everything StableCollection renders: ids, refs, the loaded file, the choice,
 *          the preview, statuses and errors, and the file, pick and download handlers
 */
export const useStableCollection = ({
  packName,
  hashes,
  download,
  readFile,
}: StableCollectionInput) => {
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
      setStatus(`Read collection.db: ${countOf(read.collections.length, "collection")}.`);
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
      `Downloaded collection.db with ${countOf(preview.added, "map")} added to "${collectionLabel(name)}". Now swap it in: the steps are above.`,
    );
    // Everything is in that collection now, so the button goes aria-disabled and keeps focus.
  };

  return {
    id,
    loaded,
    reading,
    readError,
    picked,
    setTypedName,
    status,
    setStatus,
    saveError,
    fileRef,
    collectionRef,
    onFile,
    options,
    unlisted,
    typedOrDefault,
    name,
    preview,
    similarIndex,
    similarListed,
    previewId,
    similarId,
    downloadDescribedBy,
    nothingToAdd,
    pick,
    onDownload,
  };
};
