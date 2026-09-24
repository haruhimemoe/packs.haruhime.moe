/**
 * @file src/utils/pack-stats.ts
 * @desc Pool stats over slots (a beatmap in two slots counts twice): length, stars, BPM. Maps
 *       whose metadata didn't load are skipped and counted. Stars come from `starsOf`, so forced
 *       slots can count with their mods. Pure; runs in the browser on metadata the page already
 *       fetched.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import type { MetaState } from "@/hooks/beatmapMetaState";

export type StatsSummary = {
  totalLength: number;
  averageLength: number;
  averageStars: number;
  minStars: number;
  maxStars: number;
  minBpm: number;
  maxBpm: number;
};

export type PackStatsResult =
  | { status: "empty" }
  | { status: "loading"; maps: number }
  | { status: "ready"; maps: number; skipped: number; summary: StatsSummary | null };

const sum = (values: readonly number[]): number => values.reduce((total, v) => total + v, 0);

/**
 * @function packStats
 * @param slots {readonly S[]} the pool's slots
 * @param getState {(beatmapId: number) => MetaState} metadata lookup
 * @param starsOf {(slot: S, meta: BeatmapMeta) => number} the stars a slot counts with (default:
 *        the plain rating)
 * @returns {PackStatsResult} empty, loading (any map still loading), or ready with a summary over
 *          the loaded maps (null when none loaded) and how many were skipped
 */
export const packStats = <S extends { beatmapId: number }>(
  slots: readonly S[],
  getState: (beatmapId: number) => MetaState,
  starsOf: (slot: S, meta: BeatmapMeta) => number = (_slot, meta) => meta.starRating,
): PackStatsResult => {
  if (slots.length === 0) return { status: "empty" };
  const loaded: { slot: S; meta: BeatmapMeta }[] = [];
  let skipped = 0;
  for (const slot of slots) {
    const state = getState(slot.beatmapId);
    if (state.status === "loading") return { status: "loading", maps: slots.length };
    if (state.status === "found") loaded.push({ slot, meta: state.meta });
    else skipped++;
  }
  if (loaded.length === 0) return { status: "ready", maps: slots.length, skipped, summary: null };
  const stars = loaded.map(({ slot, meta }) => starsOf(slot, meta));
  const bpms = loaded.map(({ meta }) => meta.bpm);
  const totalLength = sum(loaded.map(({ meta }) => meta.lengthSeconds));
  return {
    status: "ready",
    maps: slots.length,
    skipped,
    summary: {
      totalLength,
      averageLength: totalLength / loaded.length,
      averageStars: sum(stars) / loaded.length,
      minStars: Math.min(...stars),
      maxStars: Math.max(...stars),
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
    },
  };
};
