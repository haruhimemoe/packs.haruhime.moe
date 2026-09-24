/**
 * @file src/utils/saved-pack-stats.ts
 * @desc Stats a saved pack carries for the public filters (filters spec): star rating, length and
 *       BPM ranges, the mods and rulesets it has, its map count, and whether every lookup it needed
 *       came back (a map osu! says doesn't exist is left out and doesn't count as missing). A slot
 *       forcing EZ, HR, DT, HT or FL counts with osu!'s rating for its whole forced set; every
 *       other slot counts with the plain rating. Forced DT and HT change length and BPM. Also the
 *       rating pairs a pack needs, when incomplete stats may be retried, and the compact index
 *       form. Pure: metadata and ratings come in, so seeded metadata (archive imports, which may
 *       lack a map's plain rating) works the same as mirror metadata.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import {
  bucketsOf,
  isModBucket,
  type ModAcronym,
  RULESETS,
  type Ruleset,
  type SlotMods,
} from "@haruhimemoe/pool";
import {
  PACK_STATS_RETRY_MAX_DAYS,
  RATING_MODS,
  SPEED_RATES,
  STAT_MOD_CODES,
  type StatModCode,
} from "@/constants/pack-stats";
import type { StarPair } from "@/constants/star-ratings";
import { type BucketEntry, type PoolSlot, slotKey } from "@/schemas/pack";
import type { IndexStats, PackStats } from "@/schemas/pack-stats";
import { slotModsMap, starPairKey } from "@/utils/slot-stars";

/**
 * The metadata stats need: any source (mirror, osu!, a seeded import) will do. A seeded import
 * may not know the plain star rating (its source only rated the map with mods): null.
 */
export type StatsMeta = Pick<BeatmapMeta, "mode" | "bpm" | "lengthSeconds"> & {
  starRating: number | null;
};

/**
 * Metadata by beatmap id: the map's details, null when osu! says the map doesn't exist (deleted,
 * or never did), or absent when nobody could check it yet.
 */
export type StatsMetaById = ReadonlyMap<number, StatsMeta | null>;

/**
 * Ratings with mods by pair key ("129891:HDDT"): a number, null when osu! won't rate that set
 * (the slot then counts without mods), or absent when it isn't known yet.
 */
export type ModRatings = ReadonlyMap<string, number | null>;

/** Stats as stored on the pack document (computedAt a Date). */
export type PackStatsRecord = Omit<PackStats, "computedAt"> & { computedAt: Date };

/**
 * @function ratedSetFor
 * @param mods {SlotMods | undefined} what a slot plays with
 * @returns {readonly ModAcronym[] | null} its forced set when that changes the star rating
 *          (holds EZ, HR, DT, HT or FL), otherwise null (the plain rating counts)
 */
const ratedSetFor = (mods: SlotMods | undefined): readonly ModAcronym[] | null =>
  mods?.kind === "forced" && mods.set.some((mod) => RATING_MODS.includes(mod)) ? mods.set : null;

/** 1 for normal speed; 1.5 with a forced DT, 0.75 with a forced HT. */
const speedOf = (mods: SlotMods | undefined): number => {
  if (mods?.kind !== "forced") return 1;
  for (const mod of mods.set) {
    const rate = SPEED_RATES[mod];
    if (rate !== undefined) return rate;
  }
  return 1;
};

/**
 * The mod codes one slot adds: a built-in bucket's code; a custom slot's forced mods, or FM for a
 * custom freemod slot. A custom slot without mods and a no-slot map add nothing.
 */
const codesOf = (slot: PoolSlot, mods: SlotMods | undefined): readonly StatModCode[] => {
  if (slot.mod === null) return [];
  if (isModBucket(slot.mod)) return [slot.mod];
  if (mods?.kind === "forced") return mods.set;
  return mods?.kind === "free" ? ["FM"] : [];
};

const round2 = (value: number): number => Math.round(value * 100) / 100;
const lowest = (values: readonly number[]): number | null =>
  values.length === 0 ? null : Math.min(...values);
const highest = (values: readonly number[]): number | null =>
  values.length === 0 ? null : Math.max(...values);
const mapNull = <T, R>(value: T | null, fn: (value: T) => R): R | null =>
  value === null ? null : fn(value);

/**
 * @function computeStats
 * @param slots {readonly PoolSlot[]} the pack's slots (a map in two slots counts twice)
 * @param buckets {readonly BucketEntry[] | undefined} its bucket list (undefined: the built-ins)
 * @param metaById {StatsMetaById} metadata by beatmap id; a map that couldn't be checked is left
 *        out of every number and makes the stats incomplete, and a map osu! says doesn't exist
 *        (null) is left out without that: no later lookup would find it. A map whose plain rating
 *        isn't known counts for length and BPM, and makes the stats incomplete wherever that
 *        rating would count.
 * @param modRatings {ModRatings} ratings with mods by pair key (see statsPairsFor)
 * @param computedAt {Date} when
 * @returns {PackStatsRecord} stars (2 decimals), length in whole seconds and whole BPM after DT
 *          and HT, each null when no map gave a value; mods in STAT_MOD_CODES order; rulesets in
 *          osu!'s order; the slot count; complete when every map was either found or confirmed
 *          gone and no rating was missing
 */
export const computeStats = (
  slots: readonly PoolSlot[],
  buckets: readonly BucketEntry[] | undefined,
  metaById: StatsMetaById,
  modRatings: ModRatings,
  computedAt: Date,
): PackStatsRecord => {
  const modsBySlot = slotModsMap(slots, bucketsOf({ buckets }));
  const stars: number[] = [];
  const lengths: number[] = [];
  const bpms: number[] = [];
  const codes = new Set<StatModCode>();
  const modes = new Set<Ruleset>();
  let complete = true;
  for (const slot of slots) {
    const mods = modsBySlot.get(slotKey(slot));
    for (const code of codesOf(slot, mods)) codes.add(code);
    const meta = metaById.get(slot.beatmapId);
    if (meta === null) continue;
    if (meta === undefined) {
      complete = false;
      continue;
    }
    modes.add(meta.mode);
    const speed = speedOf(mods);
    lengths.push(meta.lengthSeconds / speed);
    bpms.push(meta.bpm * speed);
    const set = ratedSetFor(mods);
    // The rating with mods when the slot forces rated mods; the plain one otherwise, or when
    // osu! won't rate that set (null). Undefined: not known yet.
    const rating =
      set === null ? meta.starRating : modRatings.get(starPairKey(slot.beatmapId, set));
    const star = rating === null ? meta.starRating : rating;
    if (star === null || star === undefined) complete = false;
    else stars.push(star);
  }
  return {
    srMin: mapNull(lowest(stars), round2),
    srMax: mapNull(highest(stars), round2),
    srAvg: stars.length === 0 ? null : round2(stars.reduce((a, b) => a + b, 0) / stars.length),
    lenMin: mapNull(lowest(lengths), Math.round),
    lenMax: mapNull(highest(lengths), Math.round),
    bpmMin: mapNull(lowest(bpms), Math.round),
    bpmMax: mapNull(highest(bpms), Math.round),
    mods: STAT_MOD_CODES.filter((code) => codes.has(code)),
    modes: RULESETS.filter((mode) => modes.has(mode)),
    count: slots.length,
    complete,
    computedAt,
  };
};

/**
 * @function statsPairsFor
 * @param slots {readonly PoolSlot[]} the pack's slots
 * @param buckets {readonly BucketEntry[] | undefined} its bucket list (undefined: the built-ins)
 * @param metaById {StatsMetaById} metadata by beatmap id
 * @returns {StarPair[]} the (beatmap, forced set) ratings computeStats needs, one per pair, sorted
 *          by key. Maps without metadata (unchecked or gone) are skipped: their stars can't count
 *          anyway.
 */
export const statsPairsFor = (
  slots: readonly PoolSlot[],
  buckets: readonly BucketEntry[] | undefined,
  metaById: StatsMetaById,
): StarPair[] => {
  const modsBySlot = slotModsMap(slots, bucketsOf({ buckets }));
  const pairs = new Map<string, StarPair>();
  for (const slot of slots) {
    const set = ratedSetFor(modsBySlot.get(slotKey(slot)));
    if (set === null || !metaById.get(slot.beatmapId)) continue;
    const key = starPairKey(slot.beatmapId, set);
    pairs.set(key, { key, beatmapId: slot.beatmapId, set: [...set] });
  }
  return [...pairs.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
};

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * @function statsRetryAt
 * @param computedAt {Date} when the incomplete stats were computed
 * @param attempts {number} how many computations in a row came out incomplete (1 or more)
 * @returns {Date} when the stats job may try again: at once after the first, then after about 1,
 *          2, 4, 8 and 16 days, and at most PACK_STATS_RETRY_MAX_DAYS; each wait is an hour short
 *          of whole days, so a daily run at the same time still counts
 */
export const statsRetryAt = (computedAt: Date, attempts: number): Date => {
  if (attempts <= 1) return new Date(computedAt.getTime());
  const days = Math.min(2 ** (attempts - 2), PACK_STATS_RETRY_MAX_DAYS);
  return new Date(computedAt.getTime() + days * DAY_MS - HOUR_MS);
};

/**
 * @function toIndexStats
 * @param stats {Omit<PackStats, "computedAt">} a pack's stats
 * @returns {IndexStats} the compact form: r, a, l, b when known; m and g comma-separated; k
 */
export const toIndexStats = (stats: Omit<PackStats, "computedAt">): IndexStats => ({
  ...(stats.srMin !== null && stats.srMax !== null ? { r: [stats.srMin, stats.srMax] } : {}),
  ...(stats.srAvg !== null ? { a: stats.srAvg } : {}),
  ...(stats.lenMin !== null && stats.lenMax !== null ? { l: [stats.lenMin, stats.lenMax] } : {}),
  ...(stats.bpmMin !== null && stats.bpmMax !== null ? { b: [stats.bpmMin, stats.bpmMax] } : {}),
  m: stats.mods.join(","),
  g: stats.modes.join(","),
  k: stats.complete,
});

/**
 * @function toPackStatsDto
 * @param record {PackStatsRecord} stats as stored
 * @returns {PackStats} the same with computedAt as an ISO string
 */
export const toPackStatsDto = (record: PackStatsRecord): PackStats => ({
  ...record,
  computedAt: record.computedAt.toISOString(),
});
