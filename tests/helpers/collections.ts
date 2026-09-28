/**
 * @file tests/helpers/collections.ts
 * @desc Shared pieces for the osu! collection tests: collection.db byte vectors written as hex
 *       (the TVs copied from @haruhimemoe/osu's tests/collection-vectors.ts, plus two with empty
 *       map entries; never binary fixtures, since .editorconfig rewrites line endings and
 *       trailing whitespace in every file), RFC 1321's test MD5s as placeholder hashes (no
 *       beatmap has them), map info with a chosen checksum, and a reader for what a download seam
 *       was handed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Mon Sep 28, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import type { MetaState } from "@/schemas/beatmap-meta";

/**
 * @function hex
 * @param text {string} hex byte pairs; spaces and line breaks are ignored
 * @returns {Uint8Array<ArrayBuffer>} the bytes
 * @throws {Error} when the text isn't whole hex byte pairs
 */
export const hex = (text: string): Uint8Array<ArrayBuffer> => {
  const clean = text.replace(/\s+/g, "");
  if (!/^(?:[0-9a-f]{2})*$/i.test(clean)) throw new Error("hex(): not hex byte pairs");
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
};

/**
 * @function bytesOf
 * @param blob {Blob} any blob
 * @returns {Promise<Uint8Array<ArrayBuffer>>} its bytes
 */
export const bytesOf = async (blob: Blob): Promise<Uint8Array<ArrayBuffer>> =>
  new Uint8Array(await blob.arrayBuffer());

/**
 * @function collectionFile
 * @param vector {string} one of the hex vectors below
 * @param name {string} the file's name (default "collection.db")
 * @returns {File} the file a player would pick
 */
export const collectionFile = (vector: string, name = "collection.db"): File =>
  new File([hex(vector)], name);

/** MD5 of "", "a", "abc" and "message digest" (RFC 1321). */
export const MD5_EMPTY = "d41d8cd98f00b204e9800998ecf8427e";
export const MD5_A = "0cc175b9c0f1b6a831c399e269772661";
export const MD5_ABC = "900150983cd24fb0d6963f7d28e17f72";
export const MD5_DIGEST = "f96b697d7cb7938d525a2f31aaf161d0";

/** TV1: version 20150203, no collections (8 bytes). */
export const TV1_EMPTY = "bb 77 33 01  00 00 00 00";

/** TV1 with two bytes after it, the way osu!.db or scores.db reads: trailing_bytes at byte 8. */
export const TV1_TRAILING = `${TV1_EMPTY}  00 01`;

/** TV2: version 20210520, one collection "Farm" holding MD5_EMPTY then MD5_A (86 bytes). */
export const TV2_FARM = `
  58 63 34 01  01 00 00 00
  0b 04 46 61 72 6d
  02 00 00 00
  0b 20 64 34 31 64 38 63 64 39 38 66 30 30 62 32 30 34 65 39 38 30 30 39 39 38 65 63 66 38 34 32 37 65
  0b 20 30 63 63 31 37 35 62 39 63 30 66 31 62 36 61 38 33 31 63 33 39 39 65 32 36 39 37 37 32 36 36 31
`;

/** TV3: "練習" (6 UTF-8 bytes) holding MD5_A, then an empty-named, empty collection (60 bytes). */
export const TV3_UNICODE_AND_EMPTY = `
  bb 77 33 01  02 00 00 00
  0b 06 e7 b7 b4 e7 bf 92
  01 00 00 00
  0b 20 30 63 63 31 37 35 62 39 63 30 66 31 62 36 61 38 33 31 63 33 39 39 65 32 36 39 37 37 32 36 36 31
  0b 00
  00 00 00 00
`;

/** TV7: claims 2 collections but holds only "A": bad_count at byte 4 (7 bytes can't hold 2). */
export const TV7_SHORT = "bb 77 33 01  02 00 00 00  0b 01 41  00 00 00 00";

/** MD5_A as a collection.db string: the 0x0b marker, length 32, then its ASCII hex digits. */
const MD5_A_STRING =
  "0b 20 30 63 63 31 37 35 62 39 63 30 66 31 62 36 61 38 33 31 63 33 39 39 65 32 36 39 37 37 32 36 36 31";

/**
 * Not one of the package's vectors: "Farm" holding an empty map entry (a 0x00 hash marker, which
 * the reader drops with a null_hash warning) then MD5_A (53 bytes).
 */
export const FARM_NULL_HASH = `
  bb 77 33 01  01 00 00 00
  0b 04 46 61 72 6d
  02 00 00 00
  00
  ${MD5_A_STRING}
`;

/**
 * Not one of the package's vectors: "Farm" holding two empty map entries, then MD5_A twice (two
 * null_hash warnings and one duplicate_hash).
 */
export const FARM_NULL_HASHES_AND_REPEAT = `
  bb 77 33 01  01 00 00 00
  0b 04 46 61 72 6d
  04 00 00 00
  00  00
  ${MD5_A_STRING}
  ${MD5_A_STRING}
`;

/**
 * @function metaFor
 * @param beatmapId {number} the difficulty
 * @param checksum {string | null} its MD5, or null
 * @returns {BeatmapMeta} map info with that checksum
 */
export const metaFor = (beatmapId: number, checksum: string | null): BeatmapMeta => ({
  beatmapId,
  beatmapsetId: beatmapId * 10,
  mode: "osu",
  title: `Title ${beatmapId}`,
  artist: "Artist",
  version: "Insane",
  creator: "Mapper",
  creatorId: 1,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5,
  checksum,
});

/**
 * @function foundWith
 * @param beatmapId {number} the difficulty
 * @param checksum {string | null} its MD5, or null
 * @returns {MetaState} a "found" state holding metaFor(beatmapId, checksum)
 */
export const foundWith = (beatmapId: number, checksum: string | null): MetaState => ({
  status: "found",
  meta: metaFor(beatmapId, checksum),
});

/**
 * @function metaFrom
 * @param states {Record<number, MetaState>} map info by beatmap id
 * @returns {(beatmapId: number) => MetaState} a getMeta that says "loading" for any other id
 */
export const metaFrom =
  (states: Readonly<Record<number, MetaState>>) =>
  (beatmapId: number): MetaState =>
    states[beatmapId] ?? { status: "loading" };

/**
 * @function downloaded
 * @param download {{ mock: { calls: unknown[][] } }} a vi.fn() passed as a download seam
 * @param call {number} which call (default the first)
 * @returns {Promise<{ filename: string; bytes: Uint8Array<ArrayBuffer> }>} what it was handed
 * @throws {Error} when that call didn't get a Blob and a file name
 */
export const downloaded = async (
  download: { mock: { calls: unknown[][] } },
  call = 0,
): Promise<{ filename: string; bytes: Uint8Array<ArrayBuffer> }> => {
  const [blob, filename] = download.mock.calls[call] ?? [];
  if (!(blob instanceof Blob) || typeof filename !== "string") {
    throw new Error(`download #${call} wasn't called with a Blob and a file name`);
  }
  return { filename, bytes: await bytesOf(blob) };
};
