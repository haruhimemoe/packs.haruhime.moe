/**
 * @file src/lib/torrent/build-torrent.ts
 * @desc Builds a BitTorrent v1 multi-file torrent from Blobs in the browser: SHA-1 pieces through
 *       crypto.subtle (pieces run across file boundaries, as v1 requires), one piece in memory at
 *       a time, progress and cancel. No library: create-torrent needs Node's path module.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { bencode } from "@/lib/torrent/bencode";
import { magnetUri } from "@/utils/magnet";

export const MIN_PIECE_LENGTH = 16 * 1024;
export const MAX_PIECE_LENGTH = 16 * 1024 * 1024;
export const TARGET_MAX_PIECES = 1500;

/**
 * @function pieceLengthFor
 * @param totalBytes {number} size of every file together
 * @returns {number} smallest power of two from 16 KiB to 16 MiB giving ≤ 1,500 pieces
 */
export const pieceLengthFor = (totalBytes: number): number => {
  let length = MIN_PIECE_LENGTH;
  while (length < MAX_PIECE_LENGTH && Math.ceil(totalBytes / length) > TARGET_MAX_PIECES) {
    length *= 2;
  }
  return length;
};

export type TorrentFile = { path: string; data: Blob };

export type TorrentInput = {
  /** Folder name (v1 `info.name`). */
  name: string;
  /** In order; each path is one file name inside the folder. */
  files: readonly TorrentFile[];
  trackers: readonly string[];
  comment?: string;
  createdBy?: string;
  creationDate?: Date;
};

export type BuiltTorrent = {
  torrent: Uint8Array<ArrayBuffer>;
  infoHash: string;
  magnet: string;
  totalBytes: number;
  pieceLength: number;
};

export type Digest = (data: Uint8Array<ArrayBuffer>) => Promise<ArrayBuffer>;

export type BuildOptions = {
  onProgress?: (hashed: number, total: number) => void;
  signal?: AbortSignal;
  digest?: Digest;
};

const sha1: Digest = (data) => crypto.subtle.digest("SHA-1", data);

/**
 * @function canHashInBrowser
 * @returns {boolean} false where crypto.subtle is missing (pages served over plain http)
 */
export const canHashInBrowser = (): boolean =>
  typeof globalThis.crypto?.subtle?.digest === "function";

const hex = (bytes: Uint8Array): string =>
  Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");

const hashPieces = async (
  files: readonly TorrentFile[],
  pieceLength: number,
  totalBytes: number,
  { onProgress, signal, digest = sha1 }: BuildOptions,
): Promise<Uint8Array<ArrayBuffer>> => {
  const pieces = new Uint8Array(Math.ceil(totalBytes / pieceLength) * 20);
  const buffer = new Uint8Array(pieceLength);
  let filled = 0;
  let index = 0;
  let hashed = 0;
  const flush = async () => {
    // digest copies its input, so the buffer can be reused right away.
    pieces.set(new Uint8Array(await digest(buffer.subarray(0, filled))), index * 20);
    index += 1;
    hashed += filled;
    filled = 0;
    onProgress?.(hashed, totalBytes);
  };
  for (const file of files) {
    let offset = 0;
    while (offset < file.data.size) {
      signal?.throwIfAborted();
      const take = Math.min(pieceLength - filled, file.data.size - offset);
      const chunk = await file.data.slice(offset, offset + take).arrayBuffer();
      buffer.set(new Uint8Array(chunk), filled);
      filled += take;
      offset += take;
      if (filled === pieceLength) await flush();
    }
  }
  if (filled > 0) await flush();
  return pieces;
};

/**
 * @function buildTorrent
 * @param input {TorrentInput} folder name, files in order, trackers, optional comment/creator/date
 * @param options {BuildOptions} progress callback, abort signal, digest (tests)
 * @returns {Promise<BuiltTorrent>} .torrent bytes, hex infohash, magnet link, sizes
 * @throws the signal's reason when aborted
 */
export const buildTorrent = async (
  input: TorrentInput,
  options: BuildOptions = {},
): Promise<BuiltTorrent> => {
  const totalBytes = input.files.reduce((total, file) => total + file.data.size, 0);
  const pieceLength = pieceLengthFor(totalBytes);
  const pieces = await hashPieces(input.files, pieceLength, totalBytes, options);
  const info = {
    files: input.files.map((file) => ({ length: file.data.size, path: [file.path] })),
    name: input.name,
    "piece length": pieceLength,
    pieces,
  };
  const digest = options.digest ?? sha1;
  const infoHash = hex(new Uint8Array(await digest(bencode(info))));
  const [announce] = input.trackers;
  const torrent = bencode({
    ...(announce ? { announce, "announce-list": input.trackers.map((tracker) => [tracker]) } : {}),
    ...(input.comment ? { comment: input.comment } : {}),
    ...(input.createdBy ? { "created by": input.createdBy } : {}),
    "creation date": Math.floor((input.creationDate ?? new Date()).getTime() / 1000),
    info,
  });
  return {
    torrent,
    infoHash,
    magnet: magnetUri({ infoHash, name: input.name, totalBytes, trackers: input.trackers }),
    totalBytes,
    pieceLength,
  };
};
