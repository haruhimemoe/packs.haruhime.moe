/**
 * @file tests/unit/utils/pack-filter-query.test.ts
 * @desc The /packs query-string codec: m:ss length text, parseFilters (unreadable params ignored),
 *       serializeFilters, and URL round trips (property-checked with fast-check).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BPM_RANGE,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  PACK_SORTS,
  STAR_RANGE,
} from "@/constants/pack-filters";
import { STAT_MOD_CODES } from "@/constants/pack-stats";
import type { SearchIndexEntry } from "@/schemas/public-pack";
import {
  filtersHref,
  formatLengthText,
  parseFilters,
  parseLengthText,
  serializeFilters,
} from "@/utils/pack-filter-query";
import { EMPTY_FILTERS, filterPacks, normalizeRange, type PackFilters } from "@/utils/pack-filters";
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
const _rated = (s: string, fields: Partial<SearchIndexEntry> = {}): SearchIndexEntry =>
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

const _names = (entries: readonly SearchIndexEntry[], filters: Partial<PackFilters>) =>
  run(entries, filters).slugs;

describe("length text", () => {
  it("formats seconds as m:ss", () => {
    expect(formatLengthText(0)).toBe("0:00");
    expect(formatLengthText(95)).toBe("1:35");
    expect(formatLengthText(600)).toBe("10:00");
  });

  it("reads m:ss, and a bare number as minutes", () => {
    expect(parseLengthText("1:35")).toBe(95);
    expect(parseLengthText(" 2:5 ")).toBe(125);
    expect(parseLengthText("3")).toBe(180);
    expect(parseLengthText("2.5")).toBe(150);
    expect(parseLengthText("2,5")).toBe(150);
    expect(parseLengthText("0:90")).toBe(90);
  });

  it("refuses anything else", () => {
    for (const text of ["", "abc", "1:2:3", ":30", "1:", "-1", "1:-5"]) {
      expect(parseLengthText(text)).toBeNull();
    }
  });
});

describe("parseFilters", () => {
  it("reads every param", () => {
    expect(
      parseFilters(
        "?sr=5.5-6.5&mods=HR,DT&len=90-180&bpm=180-&mode=osu,mania&maps=10-20&sort=sr-asc&q=spring+cup",
      ),
    ).toEqual({
      q: "spring cup",
      sr: [5.5, 6.5],
      mods: ["HR", "DT"],
      len: [90, 180],
      bpm: [180, null],
      mode: ["osu", "mania"],
      maps: [10, 20],
      sort: "sr-asc",
    });
  });

  it("gives the defaults for no params, with or without the question mark", () => {
    expect(parseFilters("")).toEqual(EMPTY_FILTERS);
    expect(parseFilters("?")).toEqual(EMPTY_FILTERS);
    expect(parseFilters("sort=name")).toEqual({ ...EMPTY_FILTERS, sort: "name" });
  });

  it("reads open and one-sided ranges", () => {
    expect(parseFilters("sr=6-").sr).toEqual([6, null]);
    expect(parseFilters("sr=6%2B").sr).toEqual([6, null]);
    // A typed "+" arrives as a space.
    expect(parseFilters("sr=6+").sr).toEqual([6, null]);
    expect(parseFilters("sr=6").sr).toEqual([6, null]);
    expect(parseFilters("sr=-6.5").sr).toEqual([0, 6.5]);
    expect(parseFilters("sr=5,5-6,5").sr).toEqual([5.5, 6.5]);
  });

  it("clamps ranges into the sliders' bounds", () => {
    expect(parseFilters("sr=5-15").sr).toEqual([5, null]);
    expect(parseFilters("bpm=20-100").bpm).toEqual([60, 100]);
    expect(parseFilters("len=0-99999").len).toBeNull();
  });

  it("puts mods and modes in chip order, without repeats, in any case", () => {
    expect(parseFilters("mods=dt,HR,dt").mods).toEqual(["HR", "DT"]);
    expect(parseFilters("mode=MANIA,osu").mode).toEqual(["osu", "mania"]);
    expect(parseFilters("mode=catch").mode).toEqual(["fruits"]);
  });

  it("ignores what it can't read", () => {
    expect(
      parseFilters(
        "sr=abc&len=5-1&bpm=--&maps=1e3&mods=XX,&mode=standard&sort=best&q=%20%20&page=2",
      ),
    ).toEqual(EMPTY_FILTERS);
    expect(parseFilters("mods=HR,ZZ,DT").mods).toEqual(["HR", "DT"]);
    expect(parseFilters("sr=Infinity-").sr).toBeNull();
    expect(parseFilters("sr=%E0%A4%A").sr).toBeNull();
  });

  it("uses the first of a repeated param", () => {
    expect(parseFilters("sort=name&sort=maps").sort).toBe("name");
  });

  it("ignores source= from links made while the Source filter existed", () => {
    for (const source of ["archive", "community", "none", "community,archive"]) {
      expect(parseFilters(`source=${source}`)).toEqual(EMPTY_FILTERS);
      expect(parseFilters(`sr=6-7&source=${source}`)).toEqual(parseFilters("sr=6-7"));
      expect(serializeFilters(parseFilters(`source=${source}`))).toBe("");
    }
  });
});

describe("serializeFilters", () => {
  it("writes only what differs from the default, in a fixed order, commas unescaped", () => {
    expect(serializeFilters(EMPTY_FILTERS)).toBe("");
    expect(
      serializeFilters({
        q: " spring cup & more ",
        sr: [5.5, 6.5],
        mods: ["HR", "DT"],
        len: [90, 180],
        bpm: [180, null],
        mode: ["osu", "mania"],
        maps: [10, 20],
        sort: "sr-asc",
      }),
    ).toBe(
      "sr=5.5-6.5&mods=HR,DT&len=90-180&bpm=180-&mode=osu,mania&maps=10-20&sort=sr-asc&q=spring%20cup%20%26%20more",
    );
  });

  it("writes a text holding a lone surrogate without throwing", () => {
    expect(serializeFilters({ ...EMPTY_FILTERS, q: "a\uD800b" })).toBe("q=a%EF%BF%BDb");
  });

  describe("in a browser without String.prototype.toWellFormed (Firefox before 119)", () => {
    const original = Object.getOwnPropertyDescriptor(String.prototype, "toWellFormed");
    const toWellFormed = original?.value as (this: string) => string;
    beforeEach(() => {
      Reflect.deleteProperty(String.prototype, "toWellFormed");
    });
    afterEach(() => {
      if (original) Object.defineProperty(String.prototype, "toWellFormed", original);
    });

    it("still writes the filters and the text", () => {
      expect("".toWellFormed).toBeUndefined();
      expect(serializeFilters({ ...EMPTY_FILTERS, mods: ["DT"] })).toBe("mods=DT");
      expect(filtersHref("/packs", { ...EMPTY_FILTERS, q: "cup" })).toBe("/packs?q=cup");
    });

    it("replaces lone surrogates and keeps pairs", () => {
      const write = (q: string) => serializeFilters({ ...EMPTY_FILTERS, q });
      expect(write("a\uD800b")).toBe("q=a%EF%BF%BDb");
      expect(write("a\uDC00b")).toBe("q=a%EF%BF%BDb");
      expect(write("\uD800")).toBe("q=%EF%BF%BD");
      expect(write("\uDC00\uD800")).toBe("q=%EF%BF%BD%EF%BF%BD");
      expect(write("cup 🌸")).toBe(`q=${encodeURIComponent("cup 🌸")}`);
    });

    it("matches toWellFormed for any text", () => {
      fc.assert(
        fc.property(fc.string({ unit: "binary" }), (q) => {
          const expected = toWellFormed.call(q).trim();
          const written = serializeFilters({ ...EMPTY_FILTERS, q });
          expect(written).toBe(expected === "" ? "" : `q=${encodeURIComponent(expected)}`);
        }),
      );
    });
  });

  it("builds the page's href", () => {
    expect(filtersHref("/packs", EMPTY_FILTERS)).toBe("/packs");
    expect(filtersHref("/packs/page/2", { ...EMPTY_FILTERS, sort: "maps" })).toBe(
      "/packs/page/2?sort=maps",
    );
  });
});

describe("URL round trip", () => {
  const range = (bounds: { min: number; max: number }, decimals: number) =>
    fc
      .tuple(
        fc.integer({ min: bounds.min * 10 ** decimals, max: bounds.max * 10 ** decimals }),
        fc.option(
          fc.integer({ min: bounds.min * 10 ** decimals, max: bounds.max * 10 ** decimals }),
        ),
      )
      .map(([low, high]) => [low / 10 ** decimals, high === null ? null : high / 10 ** decimals]);

  const subset = <T>(values: readonly T[]) =>
    fc.subarray([...values]).map((picked) => values.filter((v) => picked.includes(v)));

  const filters = fc
    .record({
      q: fc.string(),
      sr: fc.option(range(STAR_RANGE, 2)),
      mods: subset(STAT_MOD_CODES),
      len: fc.option(range(LENGTH_RANGE, 0)),
      bpm: fc.option(range(BPM_RANGE, 0)),
      mode: subset(["osu", "taiko", "fruits", "mania"] as const),
      maps: fc.option(range(MAP_COUNT_RANGE, 0)),
      sort: fc.constantFrom(...PACK_SORTS),
    })
    .map(
      (f): PackFilters => ({
        ...f,
        q: f.q.toWellFormed().trim(),
        sr: f.sr && normalizeRange(f.sr as [number, number | null], STAR_RANGE),
        len: f.len && normalizeRange(f.len as [number, number | null], LENGTH_RANGE),
        bpm: f.bpm && normalizeRange(f.bpm as [number, number | null], BPM_RANGE),
        maps: f.maps && normalizeRange(f.maps as [number, number | null], MAP_COUNT_RANGE),
      }),
    );

  it("gives back the same filters", () => {
    fc.assert(
      fc.property(filters, (f) => {
        expect(parseFilters(serializeFilters(f))).toEqual(f);
      }),
    );
  });

  it("writes the same URL again after a parse", () => {
    fc.assert(
      fc.property(fc.string(), (search) => {
        const once = serializeFilters(parseFilters(search));
        expect(serializeFilters(parseFilters(once))).toBe(once);
      }),
    );
  });
});
