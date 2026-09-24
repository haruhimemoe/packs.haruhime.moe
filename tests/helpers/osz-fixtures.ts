/**
 * @file tests/helpers/osz-fixtures.ts
 * @desc Synthetic .osz archives for background-removal tests, built with fflate: a .osu builder,
 *       a zip builder, a streaming-style zip builder (data descriptors after each entry), a raw
 *       name-byte patcher (for names without the UTF-8 flag, or not UTF-8 at all), and seeded noise
 *       bytes. Real .osz files are copyrighted and never committed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { crc32 } from "node:zlib";
import { deflateSync, strToU8, type Zippable, zipSync } from "fflate";

/**
 * @function osuFile
 * @param events {string[]} lines for the [Events] section
 * @param title {string} Title: field, so two diffs differ
 * @returns {string} a small .osu file with CRLF line endings, like the ones osu! writes
 */
export const osuFile = (events: string[], title = "Test"): string =>
  [
    "osu file format v14",
    "",
    "[General]",
    "AudioFilename: audio.mp3",
    "",
    "[Metadata]",
    `Title:${title}`,
    "",
    "[Events]",
    "//Background and Video events",
    ...events,
    "//Break Periods",
    "",
    "[HitObjects]",
    "256,192,1000,1,0,0:0:0:0:",
    "",
  ].join("\r\n");

export type FixtureEntry = [name: string, data: string | Uint8Array];

/**
 * @function makeOsz
 * @param entries {FixtureEntry[]} name and contents, in archive order
 * @param level {0 | 6} deflate level for every entry (6 = compressed, like real .osz files)
 * @returns {Uint8Array<ArrayBuffer>} the zip
 */
export const makeOsz = (entries: FixtureEntry[], level: 0 | 6 = 6): Uint8Array<ArrayBuffer> => {
  const files: Zippable = {};
  for (const [name, data] of entries) {
    files[name] = [typeof data === "string" ? strToU8(data) : data, { level }];
  }
  return new Uint8Array(zipSync(files));
};

/**
 * @function makeStreamedOsz
 * @param entries {FixtureEntry[]} name and contents, in archive order
 * @param options {{ signature: boolean; zip64?: boolean }} signature: whether each data descriptor
 *        starts with PK\x07\x08. zip64: write each local header the way Python's zipfile does with
 *        force_zip64 (sizes 0xFFFFFFFF, a 0x0001 extra field, 8-byte sizes in the descriptor);
 *        the central directory stays plain 32-bit
 * @returns {Uint8Array<ArrayBuffer>} a zip written the way streaming writers write one: every entry
 *          deflated with general purpose bit 3 set, zero CRC and sizes in its local header, and a
 *          data descriptor (16 bytes with the signature, 12 without; 24 and 20 with zip64) after
 *          its data
 */
export const makeStreamedOsz = (
  entries: FixtureEntry[],
  { signature, zip64 = false }: { signature: boolean; zip64?: boolean },
): Uint8Array<ArrayBuffer> => {
  const parts: Uint8Array[] = [];
  const records: Uint8Array[] = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const raw = typeof data === "string" ? strToU8(data) : data;
    const nameBytes = strToU8(name);
    const packed = deflateSync(raw);
    const crc = crc32(raw);

    const extraLength = zip64 ? 20 : 0;
    const local = new Uint8Array(30 + nameBytes.length + extraLength);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, zip64 ? 45 : 20, true);
    lv.setUint16(6, 0x0008, true);
    lv.setUint16(8, 8, true);
    lv.setUint16(12, 0x21, true);
    lv.setUint16(26, nameBytes.length, true);
    lv.setUint16(28, extraLength, true);
    local.set(nameBytes, 30);
    if (zip64) {
      lv.setUint32(18, 0xffffffff, true);
      lv.setUint32(22, 0xffffffff, true);
      const extra = 30 + nameBytes.length;
      lv.setUint16(extra, 0x0001, true);
      lv.setUint16(extra + 2, 16, true);
    }

    const sizeWidth = zip64 ? 8 : 4;
    const descriptor = new Uint8Array((signature ? 8 : 4) + 2 * sizeWidth);
    const dv = new DataView(descriptor.buffer);
    const at = signature ? 4 : 0;
    if (signature) dv.setUint32(0, 0x08074b50, true);
    dv.setUint32(at, crc, true);
    dv.setUint32(at + 4, packed.length, true);
    dv.setUint32(at + 4 + sizeWidth, raw.length, true);

    const record = new Uint8Array(46 + nameBytes.length);
    const rv = new DataView(record.buffer);
    rv.setUint32(0, 0x02014b50, true);
    rv.setUint16(4, 20, true);
    rv.setUint16(6, 20, true);
    rv.setUint16(8, 0x0008, true);
    rv.setUint16(10, 8, true);
    rv.setUint16(14, 0x21, true);
    rv.setUint32(16, crc, true);
    rv.setUint32(20, packed.length, true);
    rv.setUint32(24, raw.length, true);
    rv.setUint16(28, nameBytes.length, true);
    rv.setUint32(42, offset, true);
    record.set(nameBytes, 46);

    parts.push(local, packed, descriptor);
    records.push(record);
    offset += local.length + packed.length + descriptor.length;
  }
  const directorySize = records.reduce((sum, record) => sum + record.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, records.length, true);
  ev.setUint16(10, records.length, true);
  ev.setUint32(12, directorySize, true);
  ev.setUint32(16, offset, true);

  const out = new Uint8Array(offset + directorySize + 22);
  let at = 0;
  for (const part of [...parts, ...records, end]) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

/**
 * @function replaceNameBytes
 * @param zip {Uint8Array<ArrayBuffer>} a zip whose entry is named `placeholder` (ASCII, so unflagged)
 * @param placeholder {string} the ASCII name to overwrite in the local and central headers
 * @param bytes {number[]} the new name bytes, same length as the placeholder
 * @returns {Uint8Array<ArrayBuffer>} a copy with the name bytes swapped and the UTF-8 flag still off
 */
export const replaceNameBytes = (
  zip: Uint8Array<ArrayBuffer>,
  placeholder: string,
  bytes: number[],
): Uint8Array<ArrayBuffer> => {
  const needle = strToU8(placeholder);
  if (needle.length !== bytes.length) throw new Error("placeholder and bytes differ in length");
  const out = new Uint8Array(zip);
  let replaced = 0;
  for (let i = 0; i <= out.length - needle.length; i++) {
    if (needle.every((byte, j) => out[i + j] === byte)) {
      out.set(bytes, i);
      replaced++;
    }
  }
  if (replaced !== 2) throw new Error(`expected 2 copies of ${placeholder}, found ${replaced}`);
  return out;
};

/**
 * @function noise
 * @param length {number} byte count
 * @param seed {number} different seeds give different bytes
 * @returns {Uint8Array} deterministic, barely compressible bytes (stand-ins for audio and images)
 */
export const noise = (length: number, seed = 1): Uint8Array => {
  const out = new Uint8Array(length);
  let x = seed;
  for (let i = 0; i < length; i++) {
    x = (x * 1103515245 + 12345) >>> 0;
    out[i] = x >>> 24;
  }
  return out;
};
