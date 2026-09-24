/**
 * @file src/utils/pack-filters.ts
 * @desc Filters and sorting for public packs, run in the browser over the search index (filters
 *       spec). Star rating, length and BPM match when the pack's range overlaps the chosen one;
 *       a pack needs every ticked mod and mode; its map count must sit inside the count range;
 *       it must come from a ticked source (community, or archive for entries with `x: 1`; both
 *       by default).
 *       Ends are inclusive, and an end at the slider's edge is open. A pack without the stats a
 *       filter needs is left out and counted as hidden, and so is a pack with incomplete stats
 *       that a range or mode rules out (the maps not looked up yet might match). Also the URL
 *       form of the filters
 *       (`?sr=5.5-6.5&mods=HR,DT&...&source=archive`), where anything unreadable is ignored. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { RULESETS, type Ruleset } from "@haruhimemoe/pool";
import {
  BPM_RANGE,
  DEFAULT_PACK_SORT,
  type FilterBounds,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  NO_SOURCE_PARAM,
  PACK_SORTS,
  PACK_SOURCES,
  type PackSort,
  type PackSource,
  STAR_RANGE,
} from "@/constants/pack-filters";
import { STAT_MOD_CODES, type StatModCode } from "@/constants/pack-stats";
import type { SearchIndexEntry } from "@/schemas/public-pack";
import { formatDuration } from "@/utils/format";
import { type PreparedEntry, searchPrepared } from "@/utils/search";

/** A chosen range: `[low, high]`, `high` null for no upper limit. */
export type FilterRange = readonly [number, number | null];

/** Everything the filter bar holds. A null range and an empty list mean "not filtered". */
export type PackFilters = {
  q: string;
  sr: FilterRange | null;
  mods: readonly StatModCode[];
  len: FilterRange | null;
  bpm: FilterRange | null;
  mode: readonly Ruleset[];
  maps: FilterRange | null;
  /** The sources shown, in PACK_SOURCES order. Unlike the other lists, all of them by default. */
  source: readonly PackSource[];
  sort: PackSort;
};

export const EMPTY_FILTERS: PackFilters = Object.freeze({
  q: "",
  sr: null,
  mods: [],
  len: null,
  bpm: null,
  mode: [],
  maps: null,
  source: PACK_SOURCES,
  sort: DEFAULT_PACK_SORT,
});

const round = (n: number, decimals: number): number => {
  const scale = 10 ** decimals;
  return Math.round(n * scale) / scale;
};

/**
 * @function normalizeRange
 * @param range {readonly [number, number | null]} a range from a slider or a URL
 * @param bounds {FilterBounds} the slider's bounds
 * @returns {FilterRange | null} the range inside the bounds and rounded, its top null when it
 *          reaches the maximum; null when it covers the whole slider, is crossed, or isn't a
 *          number
 */
export const normalizeRange = (
  range: readonly [number, number | null],
  bounds: FilterBounds,
): FilterRange | null => {
  const [rawLow, rawHigh] = range;
  if (!Number.isFinite(rawLow) || (rawHigh !== null && !Number.isFinite(rawHigh))) return null;
  const low = round(Math.min(Math.max(rawLow, bounds.min), bounds.max), bounds.decimals);
  const high =
    rawHigh === null || rawHigh >= bounds.max
      ? null
      : round(Math.max(rawHigh, bounds.min), bounds.decimals);
  if (high !== null && high < low) return null;
  if (low <= bounds.min && high === null) return null;
  return [low, high];
};

/**
 * @function hasStatFilters
 * @param filters {PackFilters} the filters
 * @returns {boolean} whether any filter needs a pack's stats (all but the map count)
 */
export const hasStatFilters = (filters: PackFilters): boolean =>
  filters.sr !== null ||
  filters.len !== null ||
  filters.bpm !== null ||
  filters.mods.length > 0 ||
  filters.mode.length > 0;

/**
 * @function hasSourceFilter
 * @param filters {PackFilters} the filters
 * @returns {boolean} whether a source chip is off
 */
export const hasSourceFilter = (filters: PackFilters): boolean =>
  PACK_SOURCES.some((source) => !filters.source.includes(source));

/**
 * @function hasFilters
 * @param filters {PackFilters} the filters
 * @returns {boolean} whether any filter row is set (what "Clear filters" clears)
 */
export const hasFilters = (filters: PackFilters): boolean =>
  hasStatFilters(filters) || filters.maps !== null || hasSourceFilter(filters);

/**
 * @function isBrowsing
 * @param filters {PackFilters} the filters
 * @returns {boolean} whether anything differs from the plain list: a filter, a search, or a sort
 */
export const isBrowsing = (filters: PackFilters): boolean =>
  hasFilters(filters) || filters.q.trim() !== "" || filters.sort !== DEFAULT_PACK_SORT;

/**
 * @function clearFilters
 * @param filters {PackFilters} the filters
 * @returns {PackFilters} the same search and sort with every filter row unset
 */
export const clearFilters = (filters: PackFilters): PackFilters => ({
  ...EMPTY_FILTERS,
  q: filters.q,
  sort: filters.sort,
});

type Verdict = "match" | "fail" | "missing";

/** Worst of two verdicts: a plain miss beats missing data, which beats a match. */
const worse = (a: Verdict, b: Verdict): Verdict =>
  a === "fail" || b === "fail" ? "fail" : a === "missing" || b === "missing" ? "missing" : "match";

/** Does a pack's [min, max] overlap the chosen range? Open at the slider's edges. */
const overlaps = (
  pack: readonly [number, number] | undefined,
  range: FilterRange | null,
  bounds: FilterBounds,
): Verdict => {
  if (range === null) return "match";
  if (pack === undefined) return "missing";
  const [low, high] = range;
  const aboveLow = low <= bounds.min || pack[1] >= low;
  const belowHigh = high === null || high >= bounds.max || pack[0] <= high;
  return aboveLow && belowHigh ? "match" : "fail";
};

/** Does the pack have every picked value? `list` is the entry's comma-separated set. */
const hasEvery = (
  list: string | undefined,
  picked: readonly string[],
  emptyIsMissing: boolean,
): Verdict => {
  if (picked.length === 0) return "match";
  if (list === undefined || (emptyIsMissing && list === "")) return "missing";
  const have = new Set(list.split(","));
  return picked.every((value) => have.has(value)) ? "match" : "fail";
};

const countInside = (count: number, range: FilterRange | null): Verdict => {
  if (range === null) return "match";
  const [low, high] = range;
  const aboveLow = low <= MAP_COUNT_RANGE.min || count >= low;
  const belowHigh = high === null || high >= MAP_COUNT_RANGE.max || count <= high;
  return aboveLow && belowHigh ? "match" : "fail";
};

/** Is the entry's source ticked? Archive packs carry `x: 1`; every other pack is community. */
const fromSource = (entry: SearchIndexEntry, picked: readonly PackSource[]): Verdict =>
  picked.includes(entry.x === 1 ? "archive" : "community") ? "match" : "fail";

/**
 * With incomplete stats, a star rating, length, BPM or mode miss may only mean the maps that
 * weren't looked up yet are missing from the numbers: count it as missing data, not a miss.
 */
const unsure = (verdict: Verdict, incomplete: boolean): Verdict =>
  incomplete && verdict === "fail" ? "missing" : verdict;

/** How one entry fares against the filter rows (not the text). */
const judge = (entry: SearchIndexEntry, filters: PackFilters): Verdict => {
  const hasStats = entry.k !== undefined;
  const incomplete = entry.k === false;
  return [
    unsure(overlaps(entry.r, filters.sr, STAR_RANGE), incomplete),
    unsure(overlaps(entry.l, filters.len, LENGTH_RANGE), incomplete),
    unsure(overlaps(entry.b, filters.bpm, BPM_RANGE), incomplete),
    // Mods come from the slots, so they're known even when a lookup failed.
    hasEvery(hasStats ? (entry.m ?? "") : undefined, filters.mods, false),
    // No rulesets with stats means no map's details came back: as good as no stats.
    unsure(hasEvery(hasStats ? (entry.g ?? "") : undefined, filters.mode, true), incomplete),
    countInside(entry.c, filters.maps),
    fromSource(entry, filters.source),
  ].reduce(worse, "match");
};

const nameOrder = new Intl.Collator("en", { sensitivity: "base", numeric: true });

const newestFirst = (a: string, b: string): number => (a < b ? 1 : a > b ? -1 : 0);

/** Average stars in one direction, packs without them last either way. */
const byStars =
  (direction: 1 | -1) =>
  (a: SearchIndexEntry, b: SearchIndexEntry): number => {
    if (a.a === undefined || b.a === undefined) {
      return (a.a === undefined ? 1 : 0) - (b.a === undefined ? 1 : 0);
    }
    return (a.a - b.a) * direction;
  };

/** Community packs (no `x`) before archive packs, like the plain list. */
const communityFirst = (a: SearchIndexEntry, b: SearchIndexEntry): number =>
  (a.x === undefined ? 0 : 1) - (b.x === undefined ? 0 : 1);

const COMPARE: Record<PackSort, (a: SearchIndexEntry, b: SearchIndexEntry) => number> = {
  new: (a, b) => communityFirst(a, b) || newestFirst(a.t ?? a.u, b.t ?? b.u),
  updated: (a, b) => newestFirst(a.u, b.u),
  "sr-asc": byStars(1),
  "sr-desc": byStars(-1),
  maps: (a, b) => b.c - a.c,
  name: (a, b) => nameOrder.compare(a.n, b.n),
};

/**
 * @function sortPacks
 * @param entries {readonly SearchIndexEntry[]} index entries
 * @param sort {PackSort} the sort
 * @returns {SearchIndexEntry[]} a sorted copy: newest created (community packs first, then
 *          archive packs, like the plain list; the update date when an entry has no creation
 *          date), recently updated, average stars either way (packs without them
 *          last), most maps, or name A to Z. Ties keep their order.
 */
export const sortPacks = (
  entries: readonly SearchIndexEntry[],
  sort: PackSort,
): SearchIndexEntry[] => [...entries].sort(COMPARE[sort]);

/**
 * @function filterPacks
 * @param prepared {readonly PreparedEntry[]} the index, from prepareSearchIndex
 * @param filters {PackFilters} the filters
 * @returns {{ entries: SearchIndexEntry[]; hidden: number }} every entry matching the text and
 *          all filter rows, sorted; and how many matched everything they had data for but lacked
 *          stats a filter needs (or had incomplete stats a range or mode ruled out)
 */
export const filterPacks = (
  prepared: readonly PreparedEntry[],
  filters: PackFilters,
): { entries: SearchIndexEntry[]; hidden: number } => {
  const q = filters.q.trim();
  const texts =
    q === ""
      ? prepared.map(({ entry }) => entry)
      : searchPrepared(prepared, q, Number.POSITIVE_INFINITY);
  const entries: SearchIndexEntry[] = [];
  let hidden = 0;
  for (const entry of texts) {
    const verdict = judge(entry, filters);
    if (verdict === "match") entries.push(entry);
    else if (verdict === "missing") hidden++;
  }
  return { entries: sortPacks(entries, filters.sort), hidden };
};

/**
 * @function formatLengthText
 * @param seconds {number} a length in seconds
 * @returns {string} "m:ss", for the length slider
 */
export const formatLengthText = (seconds: number): string => formatDuration(seconds);

/**
 * @function parseLengthText
 * @param text {string} what was typed in the length slider's box
 * @returns {number | null} seconds: "1:35" is 95, a bare number is minutes ("3" is 180, "2.5"
 *          or "2,5" is 150); null for anything else
 */
export const parseLengthText = (text: string): number | null => {
  const trimmed = text.trim().replace(",", ".");
  const clock = /^(\d+):(\d+)$/.exec(trimmed);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  if (/^\d+(\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 60);
  return null;
};

const NUMBER = String.raw`\d+(?:\.\d+)?`;
const RANGE_TEXT = new RegExp(`^(${NUMBER})?-(${NUMBER})?$`);
const OPEN_TEXT = new RegExp(`^(${NUMBER})\\+?$`);

/** "5.5-6.5", "6-", "-6.5", "6+" or "6" (6 and up); commas read as decimal points. */
const parseRange = (raw: string | null, bounds: FilterBounds): FilterRange | null => {
  if (raw === null) return null;
  const text = raw.trim().replaceAll(",", ".");
  const open = OPEN_TEXT.exec(text);
  if (open) return normalizeRange([Number(open[1]), null], bounds);
  const range = RANGE_TEXT.exec(text);
  if (!range || (range[1] === undefined && range[2] === undefined)) return null;
  return normalizeRange(
    [
      range[1] === undefined ? bounds.min : Number(range[1]),
      range[2] === undefined ? null : Number(range[2]),
    ],
    bounds,
  );
};

/** Values from a comma list that are in `allowed`, in `allowed`'s order. */
const pickList = <T extends string>(
  raw: string | null,
  allowed: readonly T[],
  read: (value: string) => string,
): T[] => {
  if (raw === null) return [];
  const picked = new Set(raw.split(",").map((value) => read(value.trim())));
  return allowed.filter((value) => picked.has(value));
};

const MODE_ALIASES: Readonly<Record<string, string>> = { catch: "fruits" };

/** Every source when the param is missing or unreadable; none for NO_SOURCE_PARAM. */
const parseSources = (raw: string | null): readonly PackSource[] => {
  if (raw === null) return PACK_SOURCES;
  if (raw.trim().toLowerCase() === NO_SOURCE_PARAM) return [];
  const picked = pickList(raw, PACK_SOURCES, (value) => value.toLowerCase());
  return picked.length === 0 ? PACK_SOURCES : picked;
};

/**
 * @function parseFilters
 * @param search {string} a query string, with or without its "?"
 * @returns {PackFilters} the filters it holds (q, sr, mods, len, bpm, mode, maps, source, sort);
 *          a param that is missing or can't be read counts as unset (for source: every source),
 *          and unknown params are ignored
 */
export const parseFilters = (search: string): PackFilters => {
  const params = new URLSearchParams(search);
  const sort = params.get("sort");
  return {
    q: (params.get("q") ?? "").trim(),
    sr: parseRange(params.get("sr"), STAR_RANGE),
    mods: pickList(params.get("mods"), STAT_MOD_CODES, (value) => value.toUpperCase()),
    len: parseRange(params.get("len"), LENGTH_RANGE),
    bpm: parseRange(params.get("bpm"), BPM_RANGE),
    mode: pickList(params.get("mode"), RULESETS, (value) => {
      const lower = value.toLowerCase();
      return MODE_ALIASES[lower] ?? lower;
    }),
    maps: parseRange(params.get("maps"), MAP_COUNT_RANGE),
    source: parseSources(params.get("source")),
    sort: (PACK_SORTS as readonly string[]).includes(sort ?? "")
      ? (sort as PackSort)
      : DEFAULT_PACK_SORT,
  };
};

const rangeText = ([low, high]: FilterRange): string => `${low}-${high ?? ""}`;

/** A surrogate pair, or a surrogate on its own. */
const SURROGATES = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF]/g;

/**
 * The text with each lone surrogate replaced by U+FFFD, as String.prototype.toWellFormed does.
 * Written out because Firefox only has toWellFormed from 119, and Next supports 111 and up.
 */
const wellFormed = (text: string): string =>
  text.replace(SURROGATES, (match) => (match.length === 2 ? match : "\uFFFD"));

/**
 * @function serializeFilters
 * @param filters {PackFilters} the filters
 * @returns {string} the query string without "?" (empty for the defaults): only what is set, in
 *          the order sr, mods, len, bpm, mode, maps, source (NO_SOURCE_PARAM for none), sort, q,
 *          with commas left readable and each lone surrogate in the text written as U+FFFD.
 *          Never throws.
 */
export const serializeFilters = (filters: PackFilters): string => {
  const parts: string[] = [];
  if (filters.sr) parts.push(`sr=${rangeText(filters.sr)}`);
  if (filters.mods.length > 0) parts.push(`mods=${filters.mods.join(",")}`);
  if (filters.len) parts.push(`len=${rangeText(filters.len)}`);
  if (filters.bpm) parts.push(`bpm=${rangeText(filters.bpm)}`);
  if (filters.mode.length > 0) parts.push(`mode=${filters.mode.join(",")}`);
  if (filters.maps) parts.push(`maps=${rangeText(filters.maps)}`);
  if (hasSourceFilter(filters)) {
    parts.push(
      `source=${filters.source.length === 0 ? NO_SOURCE_PARAM : filters.source.join(",")}`,
    );
  }
  if (filters.sort !== DEFAULT_PACK_SORT) parts.push(`sort=${filters.sort}`);
  // encodeURIComponent throws on a lone surrogate.
  const q = wellFormed(filters.q).trim();
  if (q !== "") parts.push(`q=${encodeURIComponent(q)}`);
  return parts.join("&");
};

/**
 * @function filtersHref
 * @param pathname {string} the page's path
 * @param filters {PackFilters} the filters
 * @returns {string} the path with the filters' query string, or the bare path for the defaults
 */
export const filtersHref = (pathname: string, filters: PackFilters): string => {
  const search = serializeFilters(filters);
  return search === "" ? pathname : `${pathname}?${search}`;
};
