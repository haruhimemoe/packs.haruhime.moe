/**
 * @file tests/unit/lib/collections/collection-files.test.ts
 * @desc Reading a picked collection.db (a file over the limit refused before it loads, one
 *       exactly at it read, the reader's errors passed through with code and offset) and the
 *       osu!stable download (a byte-for-byte round trip).
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import { CollectionDbError, readCollectionDb } from "@haruhimemoe/osu/collections";
import { describe, expect, it, vi } from "vitest";
import { readCollectionFile, stableCollectionFile } from "@/lib/collections/collection-files";
import {
  bytesOf,
  hex,
  MD5_A,
  MD5_EMPTY,
  TV1_EMPTY,
  TV1_TRAILING,
  TV2_FARM,
  TV3_UNICODE_AND_EMPTY,
  TV7_SHORT,
} from "../../../helpers/collections";

describe("readCollectionFile", () => {
  it("reads a collection.db", async () => {
    await expect(readCollectionFile(new Blob([hex(TV2_FARM)]))).resolves.toMatchObject({
      version: 20210520,
      collections: [{ name: "Farm", hashes: [MD5_EMPTY, MD5_A] }],
      warnings: [],
      omittedWarnings: 0,
    });
  });

  it("keeps an empty name and reports it as a warning", async () => {
    const read = await readCollectionFile(new Blob([hex(TV3_UNICODE_AND_EMPTY)]));
    expect(read.collections).toEqual([
      { name: "練習", hashes: [MD5_A] },
      { name: "", hashes: [] },
    ]);
    expect(read.warnings).toEqual([expect.objectContaining({ code: "empty_name", collection: 1 })]);
  });

  it("refuses a file over the limit without loading it", async () => {
    const arrayBuffer = vi.fn();
    const big = { size: 65 * 1024 * 1024, arrayBuffer } as unknown as Blob;
    await expect(readCollectionFile(big)).rejects.toMatchObject({
      name: "CollectionDbError",
      code: "too_large",
    });
    expect(arrayBuffer).not.toHaveBeenCalled();
    // TV2 is 86 bytes.
    await expect(readCollectionFile(new Blob([hex(TV2_FARM)]), 85)).rejects.toBeInstanceOf(
      CollectionDbError,
    );
  });

  it("reads a file exactly at the limit", async () => {
    // TV1 is 8 bytes with no collections. Not TV2 at 86: the reader also caps collections plus
    // hashes at maxBytes / 34, and TV2's three are over the two that 86 bytes allow.
    await expect(readCollectionFile(new Blob([hex(TV1_EMPTY)]), 8)).resolves.toMatchObject({
      version: 20150203,
      collections: [],
    });
  });

  it.each([
    ["TV7_SHORT", TV7_SHORT, "bad_count", 4],
    ["TV1_TRAILING (osu!.db or scores.db)", TV1_TRAILING, "trailing_bytes", 8],
  ])(
    "passes the reader's error for %s through, code and offset included",
    async (_, vector, code, offset) => {
      await expect(readCollectionFile(new Blob([hex(vector)]))).rejects.toMatchObject({
        code,
        offset,
      });
    },
  );
});

describe("stableCollectionFile", () => {
  it.each([
    ["TV2_FARM", TV2_FARM],
    ["TV3_UNICODE_AND_EMPTY", TV3_UNICODE_AND_EMPTY],
  ])("writes %s back byte for byte", async (_, vector) => {
    const blob = stableCollectionFile(readCollectionDb(hex(vector)));
    expect(blob.type).toBe("application/octet-stream");
    expect(await bytesOf(blob)).toEqual(hex(vector));
  });
});
