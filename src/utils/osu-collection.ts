/**
 * @file src/utils/osu-collection.ts
 * @desc Pure helpers for the "Add to osu! collection" card: the pack's difficulty MD5s from the
 *       map info the page already loaded (and the maps that can't go in a collection, with why),
 *       the default name for a new collection, and user text for the collection.db errors, each
 *       with the package's code.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import {
  CollectionDbError,
  collectionHashesFor,
  MAX_COLLECTION_NAME_BYTES,
} from "@haruhimemoe/osu/collections";
import { bucketsOf, slotTitle, sortSlots } from "@haruhimemoe/pool";
import { DEFAULT_PACK_NAME } from "@/constants/pack";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { Pool } from "@/schemas/pack";

/**
 * A map the card leaves out: the mirror and osu! don't know it, or its info has no checksum. One
 * per map: `label` names every slot it fills, in pool order ("NM1, DT1").
 */
export type SkippedMap = { beatmapId: number; label: string; reason: "missing" | "no-checksum" };

/** What the card can add: wait, retry the map info, or these hashes (with the maps left out). */
export type CollectionMaps =
  | { status: "loading" }
  | { status: "error"; failed: number }
  | { status: "ready"; hashes: string[]; skipped: SkippedMap[] };

const utf8 = new TextEncoder();
const CONTROL = /\p{Cc}/gu;
const REPLACEMENT_CHARACTER = "\uFFFD";
const FILE_HELP = "Pick the collection.db in your osu! folder, not osu!.db or scores.db.";

/**
 * @function collectionMaps
 * @param pack {Pool} the pack on the page
 * @param getMeta {(beatmapId: number) => MetaState} the map info the page loaded
 * @returns {CollectionMaps} "loading" while any map's info loads, "error" with how many maps
 *          failed once none is loading, else the lowercase MD5s in pool order without repeats and
 *          the maps left out, in pool order. Pool order follows the pack's own buckets, and a map
 *          in two slots counts once everywhere.
 */
export const collectionMaps = (
  pack: Pool,
  getMeta: (beatmapId: number) => MetaState,
): CollectionMaps => {
  const rows = sortSlots(pack.slots, bucketsOf(pack)).map((slot) => ({
    slot,
    state: getMeta(slot.beatmapId),
  }));
  if (rows.some(({ state }) => state.status === "loading")) return { status: "loading" };
  const failed = new Set(
    rows.filter(({ state }) => state.status === "error").map(({ slot }) => slot.beatmapId),
  ).size;
  if (failed > 0) return { status: "error", failed };

  const entries = rows.map(({ slot, state }) => ({
    slot,
    missing: state.status === "missing",
    checksum: state.status === "found" ? state.meta.checksum : null,
  }));
  const { hashes, withoutChecksum } = collectionHashesFor(entries);
  // Every slot of a map has the same info, so the first slot's reason holds for the rest.
  const skipped = new Map<number, SkippedMap>();
  for (const { slot, missing } of withoutChecksum) {
    const label = slotTitle(slot);
    const seen = skipped.get(slot.beatmapId);
    if (seen) seen.label = `${seen.label}, ${label}`;
    else {
      skipped.set(slot.beatmapId, {
        beatmapId: slot.beatmapId,
        label,
        reason: missing ? "missing" : "no-checksum",
      });
    }
  }
  return { status: "ready", hashes, skipped: [...skipped.values()] };
};

// One code point from `for...of`: a lone UTF-16 surrogate comes through on its own.
const isLoneSurrogate = (char: string): boolean => {
  const unit = char.charCodeAt(0);
  return char.length === 1 && unit >= 0xd800 && unit <= 0xdfff;
};

/**
 * @function defaultCollectionName
 * @param packName {string} the pack's name (empty while it's being typed on /new)
 * @returns {string} the name trimmed, with control characters as spaces and lone surrogates as
 *          U+FFFD, cut to MAX_COLLECTION_NAME_BYTES (127) UTF-8 bytes on a character boundary and
 *          trimmed again; DEFAULT_PACK_NAME when nothing is left. addToCollection accepts it.
 */
export const defaultCollectionName = (packName: string): string => {
  let name = "";
  let bytes = 0;
  for (const char of packName.replace(CONTROL, " ").trim()) {
    const safe = isLoneSurrogate(char) ? REPLACEMENT_CHARACTER : char;
    const size = utf8.encode(safe).length;
    if (bytes + size > MAX_COLLECTION_NAME_BYTES) break;
    name += safe;
    bytes += size;
  }
  return name.trim() || DEFAULT_PACK_NAME;
};

/**
 * @function collectionErrorText
 * @param error {unknown} what reading, adding or writing threw
 * @returns {string} a sentence for the player, with the CollectionDbError code (and the byte, for
 *          read errors) in parentheses; unknown codes read as a file packs can't read
 */
export const collectionErrorText = (error: unknown): string => {
  if (!(error instanceof CollectionDbError)) return "Couldn't read that file. Try again.";
  const code = error.offset === null ? error.code : `${error.code} at byte ${error.offset}`;
  switch (error.code) {
    case "too_large":
      return `That's too big for a collection.db (${code}). ${FILE_HELP}`;
    case "name_too_long":
      return `That name is too long for a new collection: at most ${MAX_COLLECTION_NAME_BYTES} bytes, and a Japanese character takes 3 (${code}).`;
    case "invalid_name":
      return `That name has a character osu! can't store, like a tab or a line break (${code}).`;
    case "invalid_hash":
    case "invalid_version":
      return `Something went wrong building the collection (${code}). Try again.`;
    default:
      return `packs can't read that file (${code}). ${FILE_HELP}`;
  }
};
