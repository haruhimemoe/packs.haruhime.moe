/**
 * @file src/utils/slot-stars.ts
 * @desc Star ratings per slot: what each slot plays with, what its star badge
 *       shows (a forced slot's modded rating with the plain one in the title; a freemod slot's
 *       plain rating plus a row of modded ones; the plain rating with a note while a forced slot's
 *       rating with mods loads, and when the calculation failed), the (beatmap, mods) pairs a pool asks /api/osu/star-ratings for, the ratings
 *       each slot gets back, and the stars pack stats use. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import {
  type ModAcronym,
  modSetsFor,
  modsLabel,
  NO_MODS,
  type SlotMods,
  slotModsFor,
} from "@haruhimemoe/pool";
import type { MetaState } from "@/hooks/beatmapMetaState";
import { type BucketEntry, type PoolSlot, slotKey } from "@/schemas/pack";
import { formatStars } from "@/utils/format";

/** One star rating with mods: the mods label ("HDDT") and the stars. */
export type ModdedRating = { mods: string; stars: number };

export const MODDED_FAILED_NOTE =
  "Couldn't calculate the rating with mods. This is the rating without mods.";
export const MODDED_LOADING_NOTE = "Rating with mods loading. This is the rating without mods.";

/**
 * What a slot's star badge shows. `title` is the mouse hover; `label` says the same to screen
 * readers inside the badge; `freemod` is one "HD 6.02" entry per mod set.
 */
export type SlotStarsView = {
  stars: number;
  title?: string;
  label?: string;
  freemod?: readonly string[];
};

/**
 * @function slotModsMap
 * @param slots {readonly PoolSlot[]} the pool
 * @param buckets {readonly BucketEntry[]} the pack's bucket list
 * @returns {Map<string, SlotMods>} slotKey -> what that slot plays with (no slot: no mods)
 */
export const slotModsMap = (
  slots: readonly PoolSlot[],
  buckets: readonly BucketEntry[],
): Map<string, SlotMods> => {
  const byCode = new Map(buckets.map((entry) => [entry.code, slotModsFor(entry)]));
  return new Map(
    slots.map((slot) => [
      slotKey(slot),
      slot.mod === null ? NO_MODS : (byCode.get(slot.mod) ?? NO_MODS),
    ]),
  );
};

/**
 * @function slotStars
 * @param nomod {number} the map's rating without mods (osu! API)
 * @param mods {SlotMods | undefined} what the slot plays with
 * @param ratings {readonly ModdedRating[] | undefined} undefined while calculating, [] when it failed
 * @returns {SlotStarsView} the badge value, its title and screen-reader label, and the freemod
 *          row entries
 */
export const slotStars = (
  nomod: number,
  mods: SlotMods | undefined,
  ratings: readonly ModdedRating[] | undefined,
): SlotStarsView => {
  if (!mods || mods.kind === "none") return { stars: nomod };
  if (ratings !== undefined && ratings.length === 0) {
    return { stars: nomod, title: MODDED_FAILED_NOTE, label: MODDED_FAILED_NOTE };
  }
  if (mods.kind === "forced") {
    const rating = ratings?.[0];
    return rating
      ? {
          stars: rating.stars,
          title: `${formatStars(nomod)}★ without mods`,
          label: `with ${mods.set.join(" ")}, ${formatStars(nomod)} without mods`,
        }
      : { stars: nomod, title: MODDED_LOADING_NOTE, label: MODDED_LOADING_NOTE };
  }
  return ratings
    ? {
        stars: nomod,
        freemod: ratings.map((r) => `${r.mods} ${formatStars(r.stars)}`),
      }
    : { stars: nomod };
};

/**
 * @function moddedStarsOf
 * @param modsBySlot {ReadonlyMap<string, SlotMods>} slotKey -> mods
 * @param ratings {ReadonlyMap<string, readonly ModdedRating[]>} slotKey -> ratings with mods
 * @returns {(slot: PoolSlot, meta: BeatmapMeta) => number} a forced slot's modded rating once
 *          known, otherwise the plain one (freemod slots always count without mods)
 */
export const moddedStarsOf =
  (
    modsBySlot: ReadonlyMap<string, SlotMods>,
    ratings: ReadonlyMap<string, readonly ModdedRating[]>,
  ) =>
  (slot: PoolSlot, meta: BeatmapMeta): number => {
    const key = slotKey(slot);
    if (modsBySlot.get(key)?.kind !== "forced") return meta.starRating;
    return ratings.get(key)?.[0]?.stars ?? meta.starRating;
  };

export const STAR_FAILED = "failed";

/** A pair's answer: its stars, or failed (osu! refused it, or the browser gave up waiting). */
export type StarPairResult = number | typeof STAR_FAILED;

/**
 * @function starPairKey
 * @param beatmapId {number} difficulty id
 * @param set {readonly ModAcronym[]} a valid mod set
 * @returns {string} "129891:HDHR", the key the route, the cache and the browser share
 */
export const starPairKey = (beatmapId: number, set: readonly ModAcronym[]): string =>
  `${beatmapId}:${modsLabel(set)}`;

type SlotSets = { key: string; beatmapId: number; sets: readonly (readonly ModAcronym[])[] };

const slotSets = (
  slots: readonly PoolSlot[],
  metaById: (beatmapId: number) => MetaState,
  modsBySlot: ReadonlyMap<string, SlotMods>,
): SlotSets[] =>
  slots.flatMap((slot) => {
    const key = slotKey(slot);
    const mods = modsBySlot.get(key);
    const state = metaById(slot.beatmapId);
    if (!mods || mods.kind === "none" || state.status !== "found") return [];
    return [{ key, beatmapId: slot.beatmapId, sets: modSetsFor(mods, state.meta.mode) }];
  });

/**
 * @function starPairsFor
 * @param slots {readonly PoolSlot[]} the pool
 * @param metaById {(beatmapId: number) => MetaState} metadata lookup (the ruleset decides freemod sets)
 * @param modsBySlot {ReadonlyMap<string, SlotMods>} slotKey -> mods
 * @returns {string[]} every pair the pool needs, unique and sorted: the canonical ?q= list
 */
export const starPairsFor = (
  slots: readonly PoolSlot[],
  metaById: (beatmapId: number) => MetaState,
  modsBySlot: ReadonlyMap<string, SlotMods>,
): string[] => {
  const pairs = new Set<string>();
  for (const { beatmapId, sets } of slotSets(slots, metaById, modsBySlot)) {
    for (const set of sets) pairs.add(starPairKey(beatmapId, set));
  }
  return [...pairs].sort();
};

/**
 * @function ratingsForSlots
 * @param slots {readonly PoolSlot[]} the pool
 * @param metaById {(beatmapId: number) => MetaState} metadata lookup
 * @param modsBySlot {ReadonlyMap<string, SlotMods>} slotKey -> mods
 * @param results {ReadonlyMap<string, StarPairResult>} pair -> answer so far
 * @returns {Map<string, ModdedRating[]>} slotKey -> ratings in display order; a slot is absent
 *          while any of its pairs is unknown, and [] once any of them failed
 */
export const ratingsForSlots = (
  slots: readonly PoolSlot[],
  metaById: (beatmapId: number) => MetaState,
  modsBySlot: ReadonlyMap<string, SlotMods>,
  results: ReadonlyMap<string, StarPairResult>,
): Map<string, ModdedRating[]> => {
  const out = new Map<string, ModdedRating[]>();
  for (const { key, beatmapId, sets } of slotSets(slots, metaById, modsBySlot)) {
    const values = sets.map((set) => results.get(starPairKey(beatmapId, set)));
    if (values.includes(STAR_FAILED)) {
      out.set(key, []);
    } else if (values.every((value) => typeof value === "number")) {
      out.set(
        key,
        sets.map((set, i) => ({ mods: modsLabel(set), stars: values[i] as number })),
      );
    }
  }
  return out;
};
