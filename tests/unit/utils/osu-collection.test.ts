/**
 * @file tests/unit/utils/osu-collection.test.ts
 * @desc The card's pure helpers: hashes from the page's map info (waiting, failures, pool order,
 *       a map in two slots, the maps left out and why), the default name for a new collection
 *       (trim, control characters, lone surrogates, the 127-byte cut, always a name
 *       addToCollection takes), and the error text with the package's codes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Fri Sep 25, 2026
 */

import {
  addToCollection,
  CollectionDbError,
  createCollectionDb,
} from "@haruhimemoe/osu/collections";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { Pool } from "@/schemas/pack";
import { collectionErrorText, collectionMaps, defaultCollectionName } from "@/utils/osu-collection";
import { foundWith, MD5_A, MD5_ABC, metaFrom } from "../../helpers/collections";

// Stored out of pool order on purpose: TB first, NM2 before NM1.
const PACK: Pool = {
  name: "SPC Quals",
  slots: [
    { mod: "TB", index: 1, beatmapId: 104 },
    { mod: "NM", index: 2, beatmapId: 102 },
    { mod: "NM", index: 1, beatmapId: 101 },
    { mod: "HD", index: 1, beatmapId: 103 },
  ],
};
const READY: Record<number, MetaState> = {
  101: foundWith(101, MD5_A),
  102: foundWith(102, MD5_ABC),
  103: foundWith(103, null),
  104: { status: "missing" },
};
const FAILED: MetaState = { status: "error", message: "The mirror didn't answer." };

describe("collectionMaps", () => {
  it("waits while any map's info loads, even when another failed", () => {
    expect(
      collectionMaps(PACK, metaFrom({ ...READY, 101: { status: "loading" }, 102: FAILED })),
    ).toEqual({ status: "loading" });
  });

  it("says how many maps failed once nothing is loading", () => {
    expect(collectionMaps(PACK, metaFrom({ ...READY, 101: FAILED, 102: FAILED }))).toEqual({
      status: "error",
      failed: 2,
    });
  });

  it("gives the hashes in pool order and lists the maps left out, with why", () => {
    expect(collectionMaps(PACK, metaFrom(READY))).toEqual({
      status: "ready",
      hashes: [MD5_A, MD5_ABC],
      skipped: [
        { beatmapId: 103, label: "HD1", reason: "no-checksum" },
        { beatmapId: 104, label: "TB1", reason: "missing" },
      ],
    });
  });

  it("adds a map that fills two slots once", () => {
    const pack: Pool = {
      name: "Twice",
      slots: [
        { mod: "NM", index: 1, beatmapId: 101 },
        { mod: "DT", index: 1, beatmapId: 101 },
      ],
    };
    expect(collectionMaps(pack, metaFrom(READY))).toEqual({
      status: "ready",
      hashes: [MD5_A],
      skipped: [],
    });
  });

  it("names a map without a slot by its position", () => {
    const pack: Pool = { name: "Loose", slots: [{ mod: null, index: 1, beatmapId: 104 }] };
    expect(collectionMaps(pack, metaFrom(READY))).toEqual({
      status: "ready",
      hashes: [],
      skipped: [{ beatmapId: 104, label: "No slot 1", reason: "missing" }],
    });
  });
});

describe("defaultCollectionName", () => {
  it.each([
    ["  SPC Quals  ", "SPC Quals"],
    ["", "Untitled pack"],
    ["   ", "Untitled pack"],
    ["SPC\tQuals\n", "SPC Quals"],
    ["SPC\uD800Quals", "SPC\uFFFDQuals"],
  ])("makes %j into %j", (packName, name) => {
    expect(defaultCollectionName(packName)).toBe(name);
  });

  it("cuts a long name to 127 UTF-8 bytes on a character boundary", () => {
    expect(defaultCollectionName("練".repeat(64))).toBe("練".repeat(42));
    expect(defaultCollectionName(`${"a".repeat(125)}😀`)).toBe("a".repeat(125));
    expect(defaultCollectionName(`${"a".repeat(123)}😀b`)).toBe(`${"a".repeat(123)}😀`);
  });

  it("trims what the cut leaves at the end", () => {
    expect(defaultCollectionName(`${"a".repeat(126)} b`)).toBe("a".repeat(126));
  });

  it("always gives a name addToCollection takes for a new collection", () => {
    // Any UTF-16 unit, so lone surrogates turn up, plus the characters the rules are about.
    const unit = fc.oneof(
      fc.integer({ min: 0, max: 0xffff }).map((code) => String.fromCharCode(code)),
      fc.string({ unit: "binary", minLength: 1, maxLength: 1 }),
      fc.constantFrom(" ", "\t", "\n", "\u3000", "\uFEFF", "練", "😀"),
    );
    fc.assert(
      fc.property(fc.string({ unit, maxLength: 200 }), (packName) => {
        const name = defaultCollectionName(packName);
        expect(addToCollection(createCollectionDb(), name, []).db.collections).toEqual([
          { name, hashes: [] },
        ]);
      }),
    );
  });
});

describe("collectionErrorText", () => {
  const FILE_HELP = "Pick the collection.db in your osu! folder, not osu!.db or scores.db.";
  const error = (code: string, offset: number | null = null) =>
    new CollectionDbError(code, "test", { offset });

  it.each([
    [error("bad_count", 4), `packs can't read that file (bad_count at byte 4). ${FILE_HELP}`],
    [
      error("trailing_bytes", 8),
      `packs can't read that file (trailing_bytes at byte 8). ${FILE_HELP}`,
    ],
    [error("a_later_code"), `packs can't read that file (a_later_code). ${FILE_HELP}`],
    [error("too_large"), `That's too big for a collection.db (too_large). ${FILE_HELP}`],
    [
      error("name_too_long"),
      "That name is too long for a new collection: at most 127 bytes, and a Japanese character takes 3 (name_too_long).",
    ],
    [
      error("invalid_name"),
      "That name has a character osu! can't store, like a tab or a line break (invalid_name).",
    ],
    [
      error("invalid_hash"),
      "Something went wrong building the collection (invalid_hash). Try again.",
    ],
    [
      error("invalid_version"),
      "Something went wrong building the collection (invalid_version). Try again.",
    ],
    [new Error("disk"), "Couldn't read that file. Try again."],
  ])("explains %s", (input, text) => {
    expect(collectionErrorText(input)).toBe(text);
  });
});
