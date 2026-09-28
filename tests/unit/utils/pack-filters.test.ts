import { describe, expect, it } from "vitest";
import {
  BPM_RANGE,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  type PACK_SORTS,
  STAR_RANGE,
} from "@/constants/pack-filters";
import type { SearchIndexEntry } from "@/schemas/public-pack";
import {
  clearFilters,
  EMPTY_FILTERS,
  filterPacks,
  hasFilters,
  hasStatFilters,
  isBrowsing,
  normalizeRange,
  type PackFilters,
  sortPacks,
} from "@/utils/pack-filters";
import { prepareSearchIndex } from "@/utils/search";

const entry = (s: string, fields: Partial<SearchIndexEntry> = {}): SearchIndexEntry => ({
  s: s.padEnd(10, "x"),
  n: s,
  o: "Chiyo",
  c: 10,
  d: "",
  u: "2026-09-20T00:00:00.000Z",
  ...fields,
});

/** An entry with complete stats: 4.00 to 6.00 stars, 1:30 to 3:00, 150 to 200 BPM. */
const rated = (s: string, fields: Partial<SearchIndexEntry> = {}): SearchIndexEntry =>
  entry(s, {
    r: [4, 6],
    a: 5,
    l: [90, 180],
    b: [150, 200],
    m: "NM,HD,HR,DT",
    g: "osu",
    k: true,
    ...fields,
  });

const run = (entries: readonly SearchIndexEntry[], filters: Partial<PackFilters>) => {
  const result = filterPacks(prepareSearchIndex(entries), { ...EMPTY_FILTERS, ...filters });
  return { slugs: result.entries.map((e) => e.n), hidden: result.hidden };
};

const names = (entries: readonly SearchIndexEntry[], filters: Partial<PackFilters>) =>
  run(entries, filters).slugs;

describe("normalizeRange", () => {
  it("leaves out a range that covers the whole slider", () => {
    expect(normalizeRange([0, null], STAR_RANGE)).toBeNull();
    expect(normalizeRange([0, 10], STAR_RANGE)).toBeNull();
    expect(normalizeRange([-3, 12], STAR_RANGE)).toBeNull();
  });

  it("clamps into the bounds and opens a top at or past the maximum", () => {
    expect(normalizeRange([5.5, 12], STAR_RANGE)).toEqual([5.5, null]);
    expect(normalizeRange([-1, 6], STAR_RANGE)).toEqual([0, 6]);
    expect(normalizeRange([12, null], STAR_RANGE)).toEqual([10, null]);
    expect(normalizeRange([30, 90], BPM_RANGE)).toEqual([60, 90]);
  });

  it("rounds stars to 2 decimals and the rest to whole numbers", () => {
    expect(normalizeRange([5.555, 6.3000000001], STAR_RANGE)).toEqual([5.56, 6.3]);
    expect(normalizeRange([90.4, 180.6], LENGTH_RANGE)).toEqual([90, 181]);
  });

  it("drops crossed or broken ranges", () => {
    expect(normalizeRange([7, 6], STAR_RANGE)).toBeNull();
    expect(normalizeRange([Number.NaN, 6], STAR_RANGE)).toBeNull();
    expect(normalizeRange([5, Number.POSITIVE_INFINITY], STAR_RANGE)).toBeNull();
  });
});

describe("star rating, length and BPM overlap", () => {
  const packs = [rated("A")];

  it.each([
    ["inside", [4.5, 5.5]],
    ["covering", [3, 7]],
    ["overlapping the bottom", [3, 4.5]],
    ["overlapping the top", [5.5, 7]],
    ["touching the bottom end", [3, 4]],
    ["touching the top end", [6, 7]],
    ["open above the bottom", [5.9, null]],
  ] as const)("matches a star range %s", (_, sr) => {
    expect(names(packs, { sr })).toEqual(["A"]);
  });

  it.each([
    ["below", [2, 3.99]],
    ["above", [6.01, 8]],
    ["open above the top", [6.01, null]],
  ] as const)("misses a star range %s", (_, sr) => {
    expect(names(packs, { sr })).toEqual([]);
  });

  it("matches length the same way, in seconds", () => {
    expect(names(packs, { len: [180, 240] })).toEqual(["A"]);
    expect(names(packs, { len: [0, 90] })).toEqual(["A"]);
    expect(names(packs, { len: [181, null] })).toEqual([]);
    expect(names(packs, { len: [0, 89] })).toEqual([]);
  });

  it("matches BPM the same way", () => {
    expect(names(packs, { bpm: [200, 250] })).toEqual(["A"]);
    expect(names(packs, { bpm: [205, null] })).toEqual([]);
    expect(names(packs, { bpm: [100, 145] })).toEqual([]);
  });

  it("reads a bottom end at the slider's minimum as no lower limit", () => {
    const slow = [rated("Slow", { b: [45, 55] })];
    expect(names(slow, { bpm: [BPM_RANGE.min, 100] })).toEqual(["Slow"]);
    expect(names(slow, { bpm: [65, 100] })).toEqual([]);
  });

  it("reads a top end at the slider's maximum as no upper limit", () => {
    const hard = [rated("Hard", { r: [10.5, 12] })];
    expect(names(hard, { sr: [9, STAR_RANGE.max] })).toEqual(["Hard"]);
    expect(names(hard, { sr: [9, 9.9] })).toEqual([]);
  });
});

describe("mods and modes", () => {
  const packs = [
    rated("Std", { m: "NM,HD,HR,DT,FM,TB", g: "osu" }),
    rated("Ez", { m: "NM,EZ,HT", g: "osu,mania" }),
    rated("None", { m: "", g: "taiko" }),
  ];

  it("needs every ticked mod", () => {
    expect(names(packs, { mods: ["HR"] })).toEqual(["Std"]);
    expect(names(packs, { mods: ["NM"] })).toEqual(["Std", "Ez"]);
    expect(names(packs, { mods: ["HR", "EZ"] })).toEqual([]);
    expect(names(packs, { mods: ["EZ", "HT"] })).toEqual(["Ez"]);
  });

  it("needs every ticked mode", () => {
    expect(names(packs, { mode: ["osu"] })).toEqual(["Std", "Ez"]);
    expect(names(packs, { mode: ["osu", "mania"] })).toEqual(["Ez"]);
    expect(names(packs, { mode: ["fruits"] })).toEqual([]);
  });
});

describe("map count", () => {
  const packs = [entry("Five", { c: 5 }), entry("Ten", { c: 10 }), entry("Fifty", { c: 50 })];

  it("keeps packs whose count sits inside the range, ends included", () => {
    expect(names(packs, { maps: [5, 10] })).toEqual(["Five", "Ten"]);
    expect(names(packs, { maps: [6, 9] })).toEqual([]);
    expect(names(packs, { maps: [10, null] })).toEqual(["Ten", "Fifty"]);
    expect(names(packs, { maps: [30, MAP_COUNT_RANGE.max] })).toEqual(["Fifty"]);
  });

  it("works without stats, since every entry has its count", () => {
    expect(run(packs, { maps: [1, 10] })).toEqual({ slugs: ["Five", "Ten"], hidden: 0 });
  });
});

describe("packs without stats", () => {
  const packs = [
    rated("Rated"),
    entry("Bare"),
    rated("No stars", { r: undefined, a: undefined, k: false }),
    rated("No modes", { g: "", k: false }),
  ];

  it("all show when no stat filter is set", () => {
    expect(run(packs, {})).toEqual({
      slugs: ["Rated", "Bare", "No stars", "No modes"],
      hidden: 0,
    });
    expect(run(packs, { q: "o", maps: [1, 20] }).hidden).toBe(0);
  });

  it("are hidden and counted once a filter needs what they lack", () => {
    expect(run(packs, { sr: [4, 6] })).toEqual({ slugs: ["Rated", "No modes"], hidden: 2 });
    expect(run(packs, { mods: ["HD"] })).toEqual({
      slugs: ["Rated", "No stars", "No modes"],
      hidden: 1,
    });
    expect(run(packs, { mode: ["osu"] })).toEqual({ slugs: ["Rated", "No stars"], hidden: 2 });
  });

  it("aren't counted when a filter they do have data for already rules them out", () => {
    // "No stars" lacks a star range but has no DT either, so it's a plain miss.
    const lacking = [rated("No stars", { r: undefined, a: undefined, m: "NM", k: false })];
    expect(run(lacking, { sr: [4, 6], mods: ["DT"] })).toEqual({ slugs: [], hidden: 0 });
    expect(run(lacking, { sr: [4, 6], mods: ["NM"] })).toEqual({ slugs: [], hidden: 1 });
  });

  it("aren't counted when the text doesn't match", () => {
    expect(run(packs, { q: "zzz", sr: [4, 6] })).toEqual({ slugs: [], hidden: 0 });
    expect(run(packs, { q: "bare", sr: [4, 6] })).toEqual({ slugs: [], hidden: 1 });
  });
});

describe("packs with incomplete stats", () => {
  // DT maps that couldn't be rated yet are missing from the range: the pack might still match.
  const partial = rated("Partial", { r: [4.8, 6.1], l: [90, 180], b: [150, 200], k: false });

  it("are hidden and counted, not dropped, when a star rating, length or BPM range misses", () => {
    expect(run([partial], { sr: [6.5, null] })).toEqual({ slugs: [], hidden: 1 });
    expect(run([partial], { len: [200, null] })).toEqual({ slugs: [], hidden: 1 });
    expect(run([partial], { bpm: [250, null] })).toEqual({ slugs: [], hidden: 1 });
  });

  it("are hidden and counted when a mode misses, since a missing map might have it", () => {
    expect(run([partial], { mode: ["taiko"] })).toEqual({ slugs: [], hidden: 1 });
  });

  it("show when what they have already matches", () => {
    expect(run([partial], { sr: [5, 5.5], mode: ["osu"] })).toEqual({
      slugs: ["Partial"],
      hidden: 0,
    });
  });

  it("are a plain miss when a mod misses, since mods come from the slots", () => {
    expect(run([partial], { mods: ["EZ"] })).toEqual({ slugs: [], hidden: 0 });
    expect(run([partial], { sr: [6.5, null], mods: ["EZ"] })).toEqual({ slugs: [], hidden: 0 });
  });

  it("are a plain miss when the map count misses", () => {
    expect(run([partial], { sr: [6.5, null], maps: [20, null] })).toEqual({
      slugs: [],
      hidden: 0,
    });
  });

  it("don't change how complete stats are judged", () => {
    expect(run([{ ...partial, k: true }], { sr: [6.5, null] })).toEqual({ slugs: [], hidden: 0 });
  });
});

describe("text and filters together", () => {
  it("needs both, and isn't capped", () => {
    const packs = Array.from({ length: 80 }, (_, i) => rated(`Cup ${i}`, { c: i + 1 }));
    expect(run(packs, { q: "cup" }).slugs).toHaveLength(80);
    expect(run(packs, { q: "cup 7", maps: [5, 20] }).slugs).toEqual(["Cup 7", "Cup 17"]);
  });
});

describe("sortPacks", () => {
  const a = entry("Alpha", {
    c: 5,
    a: 6,
    u: "2026-09-21T00:00:00.000Z",
    t: "2026-09-01T00:00:00.000Z",
  });
  const b = entry("bravo", {
    c: 20,
    a: 3,
    u: "2026-09-23T00:00:00.000Z",
    t: "2026-09-03T00:00:00.000Z",
  });
  const c = entry("Charlie", {
    c: 20,
    u: "2026-09-22T00:00:00.000Z",
    t: "2026-09-02T00:00:00.000Z",
  });
  const d = entry("Delta", { c: 7, a: 3, u: "2026-09-20T00:00:00.000Z" });
  const order = (sort: (typeof PACK_SORTS)[number], entries = [a, b, c, d]) =>
    sortPacks(entries, sort).map((e) => e.n);

  it("puts the newest created first, using the update date when an entry has no creation date", () => {
    expect(order("new")).toEqual(["Delta", "bravo", "Charlie", "Alpha"]);
  });

  it("puts the most recently updated first", () => {
    expect(order("updated")).toEqual(["bravo", "Charlie", "Alpha", "Delta"]);
  });

  it("sorts by average stars both ways, packs without them last, ties in index order", () => {
    expect(order("sr-asc")).toEqual(["bravo", "Delta", "Alpha", "Charlie"]);
    expect(order("sr-desc")).toEqual(["Alpha", "bravo", "Delta", "Charlie"]);
    expect(order("sr-asc", [d, b, a])).toEqual(["Delta", "bravo", "Alpha"]);
  });

  it("puts the biggest packs first, ties in index order", () => {
    expect(order("maps")).toEqual(["bravo", "Charlie", "Delta", "Alpha"]);
    expect(order("maps", [c, b])).toEqual(["Charlie", "bravo"]);
  });

  it("sorts names A to Z, ignoring case, numbers in number order", () => {
    expect(order("name")).toEqual(["Alpha", "bravo", "Charlie", "Delta"]);
    expect(order("name", [entry("Cup 10"), entry("cup 9"), entry("Cup 9")])).toEqual([
      "cup 9",
      "Cup 9",
      "Cup 10",
    ]);
  });

  it("doesn't change the list it was given", () => {
    const entries = [a, b, c, d];
    sortPacks(entries, "name");
    expect(entries.map((e) => e.n)).toEqual(["Alpha", "bravo", "Charlie", "Delta"]);
  });

  it("sorts filter results", () => {
    const result = filterPacks(prepareSearchIndex([a, b, c, d]), {
      ...EMPTY_FILTERS,
      sort: "maps",
    });
    expect(result.entries.map((e) => e.n)).toEqual(["bravo", "Charlie", "Delta", "Alpha"]);
  });
});

describe("filter state", () => {
  it("tells stat filters, any filter, and any change from the default apart", () => {
    expect(isBrowsing(EMPTY_FILTERS)).toBe(false);
    expect(hasFilters(EMPTY_FILTERS)).toBe(false);
    const sorted = { ...EMPTY_FILTERS, sort: "name" as const };
    expect([isBrowsing(sorted), hasFilters(sorted)]).toEqual([true, false]);
    const searched = { ...EMPTY_FILTERS, q: " cup " };
    expect([isBrowsing(searched), hasFilters(searched)]).toEqual([true, false]);
    expect(isBrowsing({ ...EMPTY_FILTERS, q: "   " })).toBe(false);
    const counted = { ...EMPTY_FILTERS, maps: [5, 10] as const };
    expect([hasFilters(counted), hasStatFilters(counted)]).toEqual([true, false]);
    for (const set of [
      { sr: [5, 6] as const },
      { len: [60, 120] as const },
      { bpm: [150, null] as const },
      { mods: ["DT" as const] },
      { mode: ["taiko" as const] },
    ]) {
      const filters = { ...EMPTY_FILTERS, ...set };
      expect([isBrowsing(filters), hasFilters(filters), hasStatFilters(filters)]).toEqual([
        true,
        true,
        true,
      ]);
    }
  });

  it("clears the filter rows but keeps the search and the sort", () => {
    const filters: PackFilters = {
      q: "cup",
      sr: [5, 6],
      mods: ["HR"],
      len: [60, 120],
      bpm: [150, null],
      mode: ["osu"],
      maps: [5, 10],
      sort: "sr-desc",
    };
    expect(clearFilters(filters)).toEqual({ ...EMPTY_FILTERS, q: "cup", sort: "sr-desc" });
  });
});
