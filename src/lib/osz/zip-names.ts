/**
 * @file src/lib/osz/zip-names.ts
 * @desc Reads a zip's central directory itself: entry order, each name's stored bytes (and the key
 *       fflate's unzip would give it), sizes, CRC, method, flags, local header offset and the raw
 *       directory record, then finds each entry's local bytes (header, data, data descriptor).
 *       Everything a rewrite needs to copy entries byte for byte without inflating them. Anything
 *       that doesn't fit the buffer, zip64, or a duplicate name is refused.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

/** The archive can't be rewritten safely; the caller keeps the original. */
export class OszRewriteError extends Error {
  override name = "OszRewriteError";
}

/** key: the name fflate's unzip gives the entry. raw: the name's bytes as stored. */
export type ZipEntryName = { key: string; raw: Uint8Array };

/** One central directory entry. record: the whole record (fixed fields, name, extra, comment). */
export type ZipEntry = ZipEntryName & {
  flags: number;
  method: number;
  crc32: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  record: Uint8Array;
};

export type ZipDirectory = { entries: ZipEntry[]; directoryOffset: number };

/** Where an entry's local bytes sit: header at start, compressed data from dataStart to dataEnd,
 *  then the data descriptor (if any) up to end. */
export type LocalEntry = { start: number; dataStart: number; dataEnd: number; end: number };

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_HEADER = 0x04034b50;
const DATA_DESCRIPTOR = 0x08074b50;
const UTF8_FLAG = 0x0800;
/** General purpose bit 3: CRC and sizes follow the data in a data descriptor. */
export const DESCRIPTOR_FLAG = 0x0008;
const MAX_COMMENT = 0xffff;
const ZIP64 = 0xffffffff;
const ZIP64_EXTRA = 0x0001;

const damaged = () => new OszRewriteError("This set's zip directory is damaged.");
const viewOf = (bytes: Uint8Array) =>
  new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

const utf8 = new TextDecoder();
// ignoreBOM keeps a leading EF BB BF in the name; the default would silently drop it (a rename).
const strictUtf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

// Matches fflate's own decoding of names without the UTF-8 flag (one byte, one character).
const latin1 = (bytes: Uint8Array): string => {
  let out = "";
  for (let i = 0; i < bytes.length; i += 4096) {
    out += String.fromCharCode(...bytes.subarray(i, i + 4096));
  }
  return out;
};

/**
 * @function writableName
 * @param raw {Uint8Array} an entry name's stored bytes
 * @returns {string} the name to hand fflate's writer, which encodes it back to these exact bytes
 * @throws {OszRewriteError} when the bytes aren't UTF-8 (writing them would rename the file)
 */
export const writableName = (raw: Uint8Array): string => {
  try {
    // fflate writes names as UTF-8 (flagged when non-ASCII), so the bytes stay the same.
    return strictUtf8.decode(raw);
  } catch (cause) {
    throw new OszRewriteError("A file name in this set isn't UTF-8.", { cause });
  }
};

/**
 * @function readZipDirectory
 * @param bytes {Uint8Array} a whole zip archive
 * @returns {ZipDirectory} every entry in central directory order, and where the directory starts
 * @throws {OszRewriteError} not a zip, zip64, a damaged directory, or a duplicate name
 */
export const readZipDirectory = (bytes: Uint8Array): ZipDirectory => {
  const view = viewOf(bytes);
  const lowest = Math.max(0, bytes.length - 22 - MAX_COMMENT);
  let end = bytes.length - 22;
  while (end >= lowest && view.getUint32(end, true) !== END_OF_DIRECTORY) end--;
  if (end < lowest) throw new OszRewriteError("This set isn't a zip archive.");

  const count = view.getUint16(end + 10, true);
  const directoryOffset = view.getUint32(end + 16, true);
  if (count === 0xffff || directoryOffset === ZIP64) {
    throw new OszRewriteError("Zip64 archives aren't supported.");
  }

  const entries: ZipEntry[] = [];
  const seen = new Set<string>();
  let offset = directoryOffset;
  for (let i = 0; i < count; i++) {
    if (offset + 46 > end || view.getUint32(offset, true) !== DIRECTORY_ENTRY) throw damaged();
    const flags = view.getUint16(offset + 8, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const recordEnd = offset + 46 + nameLength + extraLength + commentLength;
    if (recordEnd > end) throw damaged();
    const compressedSize = view.getUint32(offset + 20, true);
    const uncompressedSize = view.getUint32(offset + 24, true);
    const localHeaderOffset = view.getUint32(offset + 42, true);
    if ([compressedSize, uncompressedSize, localHeaderOffset].includes(ZIP64)) {
      throw new OszRewriteError("Zip64 archives aren't supported.");
    }
    const raw = bytes.subarray(offset + 46, offset + 46 + nameLength);
    const key = flags & UTF8_FLAG ? utf8.decode(raw) : latin1(raw);
    if (seen.has(key)) throw new OszRewriteError("This set has two files with the same name.");
    seen.add(key);
    entries.push({
      key,
      raw,
      flags,
      method: view.getUint16(offset + 10, true),
      crc32: view.getUint32(offset + 16, true),
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
      record: bytes.subarray(offset, recordEnd),
    });
    offset = recordEnd;
  }
  return { entries, directoryOffset };
};

/**
 * @function readZipEntryNames
 * @param bytes {Uint8Array} a whole zip archive
 * @returns {ZipEntryName[]} every entry, in central directory order
 * @throws {OszRewriteError} not a zip, zip64, a damaged directory, or a duplicate name
 */
export const readZipEntryNames = (bytes: Uint8Array): ZipEntryName[] =>
  readZipDirectory(bytes).entries;

/**
 * @function locateLocalEntry
 * @param bytes {Uint8Array} the whole zip archive the entry came from
 * @param entry {ZipEntry} one entry from readZipDirectory
 * @returns {LocalEntry} where its local header, compressed data and data descriptor sit. A
 *          descriptor (flag bit 3) is 16 bytes when it starts with PK\x07\x08, otherwise 12.
 * @throws {OszRewriteError} when the local header is missing or zip64 (sizes 0xFFFFFFFF or a
 *         0x0001 extra field, whose descriptor would be 24 or 20 bytes), its flags or name differ
 *         from the directory's, the data or descriptor runs past the buffer, or the descriptor's
 *         CRC differs
 */
export const locateLocalEntry = (bytes: Uint8Array, entry: ZipEntry): LocalEntry => {
  const view = viewOf(bytes);
  const start = entry.localHeaderOffset;
  if (start + 30 > bytes.length || view.getUint32(start, true) !== LOCAL_HEADER) throw damaged();
  const flags = view.getUint16(start + 6, true);
  const nameLength = view.getUint16(start + 26, true);
  const extraLength = view.getUint16(start + 28, true);
  if ((flags & DESCRIPTOR_FLAG) !== (entry.flags & DESCRIPTOR_FLAG)) throw damaged();
  const dataStart = start + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length) throw damaged();
  if (view.getUint32(start + 18, true) === ZIP64 || view.getUint32(start + 22, true) === ZIP64) {
    throw new OszRewriteError("Zip64 archives aren't supported.");
  }
  for (let at = start + 30 + nameLength; at + 4 <= dataStart; ) {
    if (view.getUint16(at, true) === ZIP64_EXTRA) {
      throw new OszRewriteError("Zip64 archives aren't supported.");
    }
    at += 4 + view.getUint16(at + 2, true);
  }
  const name = bytes.subarray(start + 30, start + 30 + nameLength);
  if (name.length !== entry.raw.length || name.some((byte, i) => byte !== entry.raw[i])) {
    throw damaged();
  }
  if (!(flags & DESCRIPTOR_FLAG)) return { start, dataStart, dataEnd, end: dataEnd };

  if (dataEnd + 12 > bytes.length) throw damaged();
  // A descriptor without the signature starts with the CRC, which could equal the signature; then
  // the next field is the compressed size, not the CRC again.
  const signed =
    view.getUint32(dataEnd, true) === DATA_DESCRIPTOR &&
    (entry.crc32 !== DATA_DESCRIPTOR || view.getUint32(dataEnd + 4, true) === DATA_DESCRIPTOR);
  const end = dataEnd + (signed ? 16 : 12);
  if (end > bytes.length || view.getUint32(signed ? dataEnd + 4 : dataEnd, true) !== entry.crc32) {
    throw damaged();
  }
  return { start, dataStart, dataEnd, end };
};
