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
 * @modified Sun Oct 4, 2026
 */

"use client";
import type { CollectionDbRead } from "@haruhimemoe/osu/collections";
import { Button, Notice, Select, Text, TextInput } from "@haruhimemoe/ui";
import { NEW, useStableCollection } from "@/hooks/useStableCollection";
import { readCollectionFile } from "@/lib/collections/collection-files";
import { collectionLabel } from "@/utils/osu-collection";
import { previewText, unlistedHint, unusualText } from "@/utils/stable-collection-text";

const FILE_HINT =
  "Close osu! first, so the file has your latest changes. It's in your osu! folder, next to osu!.db. On Windows that's usually %LOCALAPPDATA%\\osu!, in the hidden AppData folder: paste %LOCALAPPDATA%\\osu! into the file picker's address bar to get there. packs reads it in this tab. It isn't uploaded or saved. No collection.db yet? Make any collection in osu!, close osu!, then load the file it writes.";

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
 * @function StableCollection
 * @param props {StableCollectionProps} the pack's name and hashes, whether map info failed, how
 *        to save, and a read seam
 * @returns {JSX.Element} the osu!stable side of the collection card
 */
export function StableCollection({
  packName,
  hashes,
  mapInfoFailed = false,
  download,
  readFile = readCollectionFile,
}: StableCollectionProps) {
  const {
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
  } = useStableCollection({ packName, hashes, download, readFile });

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
      {reading ? <Text tone="muted">Reading collection.db…</Text> : null}
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
            <Text tone="muted">
              {mapInfoFailed
                ? `Some map info didn't load. Press "Retry loading maps" in the Download card, and the preview shows once it has.`
                : "The preview shows once every map's info has loaded."}
            </Text>
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
