/**
 * @file tests/unit/lib/osz/zip-names.test.ts
 * @desc Central directory reader: order, fflate-compatible keys for flagged and unflagged names,
 *       exact name bytes, each entry's sizes, offsets and raw record, where its local bytes start
 *       and end (data descriptors too), and every refusal (not a zip, damaged, duplicate, zip64,
 *       not UTF-8, offsets or sizes that don't fit).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { crc32 } from "node:zlib";
import { inflateSync, strToU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  locateLocalEntry,
  OszRewriteError,
  readZipDirectory,
  readZipEntryNames,
  writableName,
} from "@/lib/osz/zip-names";
import { makeOsz, makeStreamedOsz, noise, replaceNameBytes } from "../../../helpers/osz-fixtures";

const viewOf = (zip: Uint8Array) => new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

// "曲.mp3" in UTF-8, patched in over a 7-byte ASCII placeholder so the UTF-8 flag stays off.
const UTF8_KYOKU = [0xe6, 0x9b, 0xb2, ...strToU8(".mp3")];

describe("readZipEntryNames", () => {
  it("lists entries in directory order with the keys fflate uses", () => {
    const zip = replaceNameBytes(
      makeOsz([
        ["b.osu", "x"],
        ["QQQ.mp3", noise(5)],
        ["曲.png", noise(5)],
        ["a/", ""],
      ]),
      "QQQ.mp3",
      UTF8_KYOKU,
    );
    const entries = readZipEntryNames(zip);
    expect(entries.map((entry) => entry.key)).toEqual(Object.keys(unzipSync(zip)));
    expect(entries.map((entry) => writableName(entry.raw))).toEqual([
      "b.osu",
      "曲.mp3",
      "曲.png",
      "a/",
    ]);
  });

  it("rejects something that isn't a zip", () => {
    expect(() => readZipEntryNames(strToU8("PK not really"))).toThrow(OszRewriteError);
    expect(() => readZipEntryNames(new Uint8Array())).toThrow(OszRewriteError);
  });

  it("rejects a damaged directory", () => {
    const zip = makeOsz([["a.osu", "x"]]);
    new DataView(zip.buffer).setUint32(zip.length - 22 + 16, 3, true);
    expect(() => readZipEntryNames(zip)).toThrow(OszRewriteError);
  });

  it("rejects two entries with the same name", () => {
    const zip = replaceNameBytes(
      makeOsz([
        ["QA.mp3", noise(5)],
        ["QB.mp3", noise(6)],
      ]),
      "QB.mp3",
      [...strToU8("QA.mp3")],
    );
    expect(() => readZipEntryNames(zip)).toThrow(OszRewriteError);
  });

  it("rejects a nameLength that runs past the end of the buffer", () => {
    const zip = makeOsz([["a.osu", "x"]]);
    const view = new DataView(zip.buffer, zip.byteOffset, zip.byteLength);
    const end = zip.length - 22;
    const dirOffset = view.getUint32(end + 16, true);
    // The only (last) entry's stored nameLength now claims more bytes than the buffer has left.
    view.setUint16(dirOffset + 28, 0xffff, true);
    expect(() => readZipEntryNames(zip)).toThrow(OszRewriteError);
  });
});

describe("readZipDirectory", () => {
  const FILES: [string, Uint8Array][] = [
    ["a.osu", strToU8("osu file format v14\r\n".repeat(50))],
    ["audio.mp3", noise(700, 2)],
  ];

  it("gives each entry's sizes, CRC, method, flags, local offset and raw record", () => {
    const zip = makeOsz(FILES);
    const { entries, directoryOffset } = readZipDirectory(zip);
    const view = viewOf(zip);
    expect(directoryOffset).toBe(view.getUint32(zip.length - 22 + 16, true));
    expect(entries.map((entry) => entry.key)).toEqual(["a.osu", "audio.mp3"]);

    let recordAt = directoryOffset;
    FILES.forEach(([, data], i) => {
      const entry = entries[i];
      if (!entry) throw new Error("missing entry");
      expect(entry.method).toBe(8);
      expect(entry.flags & 0x0008).toBe(0);
      expect(entry.crc32).toBe(crc32(data));
      expect(entry.uncompressedSize).toBe(data.length);
      expect(entry.localHeaderOffset).toBe(view.getUint32(recordAt + 42, true));
      expect(view.getUint32(entry.localHeaderOffset, true)).toBe(0x04034b50);
      expect(entry.record).toEqual(zip.subarray(recordAt, recordAt + entry.record.length));
      expect(entry.record.length).toBe(46 + entry.raw.length);
      recordAt += entry.record.length;
    });
    expect(entries[0]?.localHeaderOffset).toBe(0);
  });

  it("rejects an entry with zip64 sizes", () => {
    const zip = makeOsz(FILES);
    const { directoryOffset } = readZipDirectory(zip);
    viewOf(zip).setUint32(directoryOffset + 20, 0xffffffff, true);
    expect(() => readZipDirectory(zip)).toThrow(OszRewriteError);
  });
});

describe("locateLocalEntry", () => {
  const FILES: [string, Uint8Array][] = [
    ["a.osu", strToU8("osu file format v14\r\n".repeat(50))],
    ["audio.mp3", noise(700, 2)],
  ];

  it("finds the header, the compressed data and the end of each entry", () => {
    const zip = makeOsz(FILES);
    const { entries, directoryOffset } = readZipDirectory(zip);
    const [first, second] = entries.map((entry) => locateLocalEntry(zip, entry));
    if (!first || !second) throw new Error("missing entry");
    expect(first.start).toBe(0);
    expect(first.dataStart).toBe(30 + "a.osu".length);
    expect(first.dataEnd - first.dataStart).toBe(entries[0]?.compressedSize);
    expect(inflateSync(zip.subarray(first.dataStart, first.dataEnd))).toEqual(FILES[0]?.[1]);
    expect(first.end).toBe(second.start);
    expect(second.end).toBe(directoryOffset);
  });

  it.each([
    ["with", true, 16],
    ["without", false, 12],
  ])("includes a data descriptor %s its signature", (_, signature, size) => {
    const zip = makeStreamedOsz(FILES, { signature });
    const { entries, directoryOffset } = readZipDirectory(zip);
    const found = entries.map((entry) => locateLocalEntry(zip, entry));
    expect(entries.every((entry) => entry.flags & 0x0008)).toBe(true);
    expect(found.map((range) => range.end - range.dataEnd)).toEqual([size, size]);
    expect(found[0]?.end).toBe(found[1]?.start);
    expect(found[1]?.end).toBe(directoryOffset);
    expect(inflateSync(zip.subarray(found[0]?.dataStart, found[0]?.dataEnd))).toEqual(
      FILES[0]?.[1],
    );
  });

  it.each([
    ["with", true],
    ["without", false],
  ])("rejects a zip64 local header (0x0001 extra, descriptor %s its signature)", (_, signature) => {
    // Python's zipfile with force_zip64: plain central directory, zip64 local header, 24- or
    // 20-byte descriptor. Taking 16 or 12 bytes would copy each entry 8 bytes short.
    const zip = makeStreamedOsz(FILES, { signature, zip64: true });
    for (const entry of readZipDirectory(zip).entries) {
      expect(() => locateLocalEntry(zip, entry)).toThrow(OszRewriteError);
    }
  });

  it("rejects a local header whose sizes are the zip64 marker", () => {
    const zip = makeStreamedOsz(FILES, { signature: true });
    const [entry] = readZipDirectory(zip).entries;
    if (!entry) throw new Error("missing entry");
    viewOf(zip).setUint32(18, 0xffffffff, true);
    expect(() => locateLocalEntry(zip, entry)).toThrow(OszRewriteError);
  });

  it("rejects a local header offset past the end of the archive", () => {
    const zip = makeOsz(FILES);
    const [, entry] = readZipDirectory(zip).entries;
    if (!entry) throw new Error("missing entry");
    expect(() => locateLocalEntry(zip, { ...entry, localHeaderOffset: zip.length - 10 })).toThrow(
      OszRewriteError,
    );
  });

  it("rejects an offset that doesn't point at a local header", () => {
    const zip = makeOsz(FILES);
    const [, entry] = readZipDirectory(zip).entries;
    if (!entry) throw new Error("missing entry");
    expect(() => locateLocalEntry(zip, { ...entry, localHeaderOffset: 4 })).toThrow(
      OszRewriteError,
    );
  });

  it("rejects compressed data that runs past the end of the archive", () => {
    const zip = makeOsz(FILES);
    const [, entry] = readZipDirectory(zip).entries;
    if (!entry) throw new Error("missing entry");
    expect(() => locateLocalEntry(zip, { ...entry, compressedSize: zip.length })).toThrow(
      OszRewriteError,
    );
  });

  it("rejects a local name that differs from the directory's", () => {
    const zip = makeOsz(FILES);
    const [entry] = readZipDirectory(zip).entries;
    if (!entry) throw new Error("missing entry");
    zip[30] = "b".charCodeAt(0);
    expect(() => locateLocalEntry(zip, entry)).toThrow(OszRewriteError);
  });

  it("rejects a data descriptor whose CRC doesn't match the directory", () => {
    const zip = makeStreamedOsz(FILES, { signature: true });
    const [entry] = readZipDirectory(zip).entries;
    if (!entry) throw new Error("missing entry");
    expect(() => locateLocalEntry(zip, { ...entry, crc32: (entry.crc32 + 1) >>> 0 })).toThrow(
      OszRewriteError,
    );
  });
});

describe("writableName", () => {
  it("rejects bytes that aren't UTF-8", () => {
    // 82 A0 is "あ" in Shift-JIS.
    expect(() => writableName(new Uint8Array([0x82, 0xa0]))).toThrow(OszRewriteError);
  });

  it("keeps a leading byte order mark instead of dropping it", () => {
    expect(writableName(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toBe("﻿a");
  });
});
