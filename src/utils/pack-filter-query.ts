/**
 * @file src/utils/pack-filter-query.ts
 * @desc The /packs filters in the query string (sr, mods, len, bpm, mode, maps, sort, q): parse
 *       what the page reads back (anything unreadable is ignored, never an error), serialize what
 *       it writes, and the lengths the filter bar types as m:ss. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatDuration } from "@haruhimemoe/osu/format";
import { RULESETS } from "@haruhimemoe/pool";
import {
  BPM_RANGE,
  DEFAULT_PACK_SORT,
  type FilterBounds,
  LENGTH_RANGE,
  MAP_COUNT_RANGE,
  PACK_SORTS,
  type PackSort,
  STAR_RANGE,
} from "@/constants/pack-filters";
import { STAT_MOD_CODES } from "@/constants/pack-stats";
import { type FilterRange, normalizeRange, type PackFilters } from "@/utils/pack-filters";

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

/**
 * @function parseFilters
 * @param search {string} a query string, with or without its "?"
 * @returns {PackFilters} the filters it holds (q, sr, mods, len, bpm, mode, maps, sort); a param
 *          that is missing or can't be read counts as unset, and unknown params are ignored
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
 *          the order sr, mods, len, bpm, mode, maps, sort, q, with commas left readable and each
 *          lone surrogate in the text written as U+FFFD. Never throws.
 */
export const serializeFilters = (filters: PackFilters): string => {
  const parts: string[] = [];
  if (filters.sr) parts.push(`sr=${rangeText(filters.sr)}`);
  if (filters.mods.length > 0) parts.push(`mods=${filters.mods.join(",")}`);
  if (filters.len) parts.push(`len=${rangeText(filters.len)}`);
  if (filters.bpm) parts.push(`bpm=${rangeText(filters.bpm)}`);
  if (filters.mode.length > 0) parts.push(`mode=${filters.mode.join(",")}`);
  if (filters.maps) parts.push(`maps=${rangeText(filters.maps)}`);
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
