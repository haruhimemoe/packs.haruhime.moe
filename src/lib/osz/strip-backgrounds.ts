/**
 * @file src/lib/osz/strip-backgrounds.ts
 * @desc Removes background-only images from a .osz in the browser. Only the .osu and .osb entries
 *       are inflated (synchronously, no worker) to find the backgrounds. The new archive copies
 *       every kept entry's original bytes (local header, name, extra, compressed data, data
 *       descriptor) in the original order, then the original directory records with only the
 *       local header offsets changed. Nothing is recompressed and no dates are written, so .osu
 *       MD5s, names and the output bytes stay the same every time.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { inflateSync } from "fflate";
import { OSZ_MIME } from "@/lib/mirror";
import {
  type LocalEntry,
  locateLocalEntry,
  OszRewriteError,
  readZipDirectory,
  writableName,
  type ZipEntry,
} from "@/lib/osz/zip-names";
import { backgroundsToRemove } from "@/utils/osz-backgrounds";

const END_OF_DIRECTORY = 0x06054b50;
const MAX_UINT32 = 0xffffffff;
const STORED = 0;
const DEFLATED = 8;

type KeptEntry = { entry: ZipEntry; local: LocalEntry };

const isScript = (name: string): boolean => /\.(osu|osb)$/i.test(name);

/** An entry's uncompressed bytes, read straight from its local data. Only used for .osu/.osb. */
const inflateEntry = (bytes: Uint8Array, entry: ZipEntry, local: LocalEntry): Uint8Array => {
  const data = bytes.subarray(local.dataStart, local.dataEnd);
  if (entry.method !== STORED && entry.method !== DEFLATED) {
    throw new OszRewriteError(`${entry.key} uses a compression this can't read.`);
  }
  let out: Uint8Array;
  try {
    out = entry.method === STORED ? data : inflateSync(data);
  } catch (cause) {
    throw new OszRewriteError(`Couldn't read ${entry.key} from this set.`, { cause });
  }
  if (out.length !== entry.uncompressedSize) {
    throw new OszRewriteError(`Couldn't read ${entry.key} from this set.`);
  }
  return out;
};

/** Local byte ranges must not overlap each other or the directory, so the copy never grows. */
const checkLayout = (locals: readonly LocalEntry[], directoryOffset: number): void => {
  const sorted = [...locals].sort((a, b) => a.start - b.start);
  let previousEnd = 0;
  for (const local of sorted) {
    if (local.start < previousEnd) throw new OszRewriteError("This set's zip entries overlap.");
    previousEnd = local.end;
  }
  if (previousEnd > directoryOffset) throw new OszRewriteError("This set's zip entries overlap.");
};

/**
 * @function rewrite
 * @param bytes {Uint8Array<ArrayBuffer>} the whole original archive
 * @param kept {KeptEntry[]} the entries to keep, in directory order
 * @returns {Blob} the kept local bytes as they were, then their directory records with new local
 *          header offsets, then an end of directory record without a comment
 * @throws {OszRewriteError} when an offset or size wouldn't fit the zip's 32-bit fields
 */
const rewrite = (bytes: Uint8Array<ArrayBuffer>, kept: readonly KeptEntry[]): Blob => {
  // Views, not copies: the Blob copies each range once.
  const parts: Uint8Array<ArrayBuffer>[] = [];
  const records: Uint8Array<ArrayBuffer>[] = [];
  let offset = 0;
  for (const { entry, local } of kept) {
    if (offset >= MAX_UINT32) throw new OszRewriteError("This set is too big to rewrite.");
    parts.push(bytes.subarray(local.start, local.end));
    const record = new Uint8Array(entry.record);
    new DataView(record.buffer).setUint32(42, offset, true);
    records.push(record);
    offset += local.end - local.start;
  }
  const directorySize = records.reduce((sum, record) => sum + record.length, 0);
  if (offset + directorySize + 22 > MAX_UINT32) {
    throw new OszRewriteError("This set is too big to rewrite.");
  }
  const end = new Uint8Array(22);
  const view = new DataView(end.buffer);
  view.setUint32(0, END_OF_DIRECTORY, true);
  view.setUint16(8, records.length, true);
  view.setUint16(10, records.length, true);
  view.setUint32(12, directorySize, true);
  view.setUint32(16, offset, true);
  return new Blob([...parts, ...records, end], { type: OSZ_MIME });
};

/**
 * @function stripBackgrounds
 * @param blob {Blob} a .osz as the mirror sent it
 * @param options {{ signal?: AbortSignal }} cancels the work
 * @returns {Promise<Blob>} the same set without background-only images: every other entry is copied
 *          byte for byte (still compressed, same name bytes, same order). The original blob when
 *          there is nothing to remove.
 * @throws {OszRewriteError} when the archive can't be read or rewritten safely
 */
export const stripBackgrounds = async (
  blob: Blob,
  { signal }: { signal?: AbortSignal } = {},
): Promise<Blob> => {
  signal?.throwIfAborted();
  const bytes = new Uint8Array(await blob.arrayBuffer());
  signal?.throwIfAborted();

  const { entries, directoryOffset } = readZipDirectory(bytes);
  const found = entries.map((entry) => ({ entry, local: locateLocalEntry(bytes, entry) }));
  checkLayout(
    found.map(({ local }) => local),
    directoryOffset,
  );

  const decoder = new TextDecoder();
  // Match names the way the .osu files spell them (UTF-8), also for names stored without the
  // UTF-8 flag, whose fflate-style keys are latin1 and would never match "曲.jpg".
  const readable = entries.map((entry) => decoder.decode(entry.raw));
  const scripts = found.flatMap(({ entry, local }, i) => {
    const name = readable[i] ?? "";
    return isScript(name)
      ? [{ name, text: decoder.decode(inflateEntry(bytes, entry, local)) }]
      : [];
  });
  signal?.throwIfAborted();

  const dropNames = new Set(backgroundsToRemove(scripts, readable));
  const kept = found.filter((_, i) => !dropNames.has(readable[i] ?? ""));
  if (kept.length === found.length) return blob;

  // Names are copied as their exact bytes, but a set with a name that isn't UTF-8 is still kept
  // as downloaded, as before.
  for (const entry of entries) writableName(entry.raw);

  const out = rewrite(bytes, kept);
  signal?.throwIfAborted();
  return out;
};
