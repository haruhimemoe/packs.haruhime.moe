import type { Ruleset } from "@haruhimemoe/pool";
import {
  BPM_RANGE,
  DEFAULT_PACK_SORT,
  type FilterBounds,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  type PackSort,
  STAR_RANGE,
} from "@/constants/pack-filters";
import type { StatModCode } from "@/constants/pack-stats";
import type { SearchIndexEntry } from "@/schemas/public-pack";
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
 * @function hasFilters
 * @param filters {PackFilters} the filters
 * @returns {boolean} whether any filter row is set (what "Clear filters" clears)
 */
export const hasFilters = (filters: PackFilters): boolean =>
  hasStatFilters(filters) || filters.maps !== null;

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

const COMPARE: Record<PackSort, (a: SearchIndexEntry, b: SearchIndexEntry) => number> = {
  new: (a, b) => newestFirst(a.t ?? a.u, b.t ?? b.u),
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
 * @returns {SearchIndexEntry[]} a sorted copy: newest created (the update date when an entry has
 *          no creation date), recently updated, average stars either way (packs without them
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
