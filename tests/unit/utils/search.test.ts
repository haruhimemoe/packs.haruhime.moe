/**
 * @file tests/unit/utils/search.test.ts
 * @desc In-browser pack search: all terms must match, across fields, ignoring case and accents.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import type { SearchIndexEntry } from "@/schemas/public-pack";
import { foldForSearch, prepareSearchIndex, searchPacks, searchPrepared } from "@/utils/search";

const entry = (s: string, n: string, o: string, d = ""): SearchIndexEntry => ({
  s,
  n,
  o,
  c: 1,
  d,
  u: "2026-09-22T00:00:00.000Z",
});

const ENTRIES = [
  entry("aaaaaaaaaa", "Pokémon Cup", "Chiyo", "Round of 16"),
  entry("bbbbbbbbbb", "SPC Finals", "peppy", "Grand finals pool"),
  entry("cccccccccc", "難しい譜面", "Mio"),
];
const slugs = (query: string, limit?: number) => searchPacks(ENTRIES, query, limit).map((e) => e.s);

describe("foldForSearch", () => {
  it("drops accents and case", () => {
    expect(foldForSearch("PokÉmon")).toBe("pokemon");
  });
});

describe("searchPacks", () => {
  it("returns nothing for an empty or blank query", () => {
    expect(slugs("")).toEqual([]);
    expect(slugs("   ")).toEqual([]);
  });

  it("matches without accents or case", () => {
    expect(slugs("pokemon")).toEqual(["aaaaaaaaaa"]);
    expect(slugs("POKÉMON")).toEqual(["aaaaaaaaaa"]);
  });

  it("needs every term, in any field", () => {
    expect(slugs("spc peppy")).toEqual(["bbbbbbbbbb"]);
    expect(slugs("spc chiyo")).toEqual([]);
    expect(slugs("round")).toEqual(["aaaaaaaaaa"]);
  });

  it("finds CJK names", () => {
    expect(slugs("譜面")).toEqual(["cccccccccc"]);
  });

  it("treats regex characters as text", () => {
    expect(slugs(".*")).toEqual([]);
  });

  it("stops at the limit, keeping index order", () => {
    expect(slugs("o", 1)).toEqual(["aaaaaaaaaa"]);
  });
});

describe("prepareSearchIndex / searchPrepared", () => {
  it("folds each entry once, up front", () => {
    const prepared = prepareSearchIndex(ENTRIES);
    expect(prepared[0]?.haystack).toBe("pokemon cup\nchiyo\nround of 16");
    expect(prepared[0]?.entry).toBe(ENTRIES[0]);
  });

  it("matches against the prepared text, not the entry again", () => {
    const [first] = ENTRIES;
    if (!first) throw new Error("fixture");
    const prepared = [{ entry: first, haystack: "prepared only" }];
    expect(searchPrepared(prepared, "prepared")).toEqual([first]);
    expect(searchPrepared(prepared, "pokemon")).toEqual([]);
  });

  it("gives the same results as searchPacks", () => {
    expect(searchPrepared(prepareSearchIndex(ENTRIES), "cup")).toEqual(searchPacks(ENTRIES, "cup"));
  });
});
