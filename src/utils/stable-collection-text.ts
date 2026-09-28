/**
 * @file src/utils/stable-collection-text.ts
 * @desc What the osu!stable collection card says: the preview of an add, what the reader found
 *       odd in a collection.db, save errors and the unlisted-collections hint. Pure; the card
 *       and useStableCollection use it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import {
  type addToCollection,
  type CollectionDb,
  CollectionDbError,
  type CollectionDbRead,
  MAX_COLLECTION_DB_BYTES,
} from "@haruhimemoe/osu/collections";
import { collectionErrorText, collectionLabel } from "@/utils/osu-collection";
import { countOf } from "@/utils/text";

/**
 * What the reader found odd: entries it kept, empty map entries (0x00 hashes) it dropped, and
 * whether it stopped listing. Warnings past its first 1,000 come without a code, so they count
 * as kept and the text allows for empty map entries among them.
 */
export type Unusual = { kept: number; dropped: number; unlisted: boolean };
export type Loaded = { db: CollectionDb; unusual: Unusual };
export type Added = ReturnType<typeof addToCollection>;
export type Preview = { kind: "error"; message: string } | ({ kind: "ok" } & Added);

/**
 * @function previewText
 * @param added {Added} what adding the pack's maps would do
 * @param name {string} the collection's name
 * @returns {string} "Adds 3 maps to "Finals". 2 are already in it." and the like
 */
export const previewText = (added: Added, name: string): string => {
  const quoted = `"${collectionLabel(name)}"`;
  if (added.created) return `Makes a new collection ${quoted} with ${countOf(added.added, "map")}.`;
  if (added.added === 0) return `All of these maps are already in ${quoted}.`;
  const already =
    added.alreadyPresent === 0
      ? ""
      : ` ${countOf(added.alreadyPresent, "is", "are")} already in it.`;
  return `Adds ${countOf(added.added, "map")} to ${quoted}.${already}`;
};

/**
 * @function unusualOf
 * @param read {CollectionDbRead} what the reader returned
 * @returns {Unusual} kept odd entries, dropped empty map entries, and whether it stopped listing
 */
export const unusualOf = (read: CollectionDbRead): Unusual => {
  const dropped = read.warnings.filter((warning) => warning.code === "null_hash").length;
  return {
    kept: read.warnings.length - dropped + read.omittedWarnings,
    dropped,
    unlisted: read.omittedWarnings > 0,
  };
};

/**
 * @function unusualText
 * @param unusual {Unusual} what the reader found odd
 * @returns {string} a sentence or two about it, or "" when nothing was
 */
export const unusualText = ({ kept, dropped, unlisted }: Unusual): string => {
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

/**
 * @function saveErrorText
 * @param error {unknown} what writing the file threw
 * @returns {string} what to tell the player, with the package's code
 */
export const saveErrorText = (error: unknown): string => {
  if (!(error instanceof CollectionDbError)) return "Couldn't save collection.db. Try again.";
  // Writing, too_large means the edited file, not the one picked: the read would have refused it.
  if (error.code === "too_large") {
    return `With these maps, collection.db would be over ${MAX_MIB} MiB, more than packs writes (${error.code}).`;
  }
  return collectionErrorText(error);
};

/**
 * @function unlistedHint
 * @param unlisted {number} collections the list leaves out
 * @returns {string} how to reach one of them
 */
export const unlistedHint = (unlisted: number): string =>
  `Your file has ${countOf(unlisted, "more collection")} than this list shows. To add to one of them, pick New collection and type its exact name.`;
