/**
 * @file src/hooks/useModdedStarRatings.ts
 * @desc Star ratings with mods for a pool (qol spec §5.2, controller ruling 2026-09-22): works out
 *       the (beatmap, mods) pairs its slots need, asks /api/osu/star-ratings with the canonical
 *       query (after a delay in the editor), and while osu! still owes pairs asks again every 5 s,
 *       at most 12 times. A pair the server leaves out, or still owes at the end, is failed, and
 *       its slot keeps the rating without mods.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { bucketsOf, type SlotMods } from "@haruhimemoe/pool";
import { useEffect, useMemo, useRef, useState } from "react";
import { STAR_MAX_RETRIES, STAR_RETRY_MS } from "@/constants/star-ratings";
import type { MetaState } from "@/hooks/beatmapMetaState";
import type { BucketEntry, PoolSlot } from "@/schemas/pack";
import { type StarRatingsResponse, starRatingsResponseSchema } from "@/schemas/star-ratings";
import {
  type ModdedRating,
  moddedStarsOf,
  ratingsForSlots,
  STAR_FAILED,
  type StarPairResult,
  slotModsMap,
  starPairsFor,
} from "@/utils/slot-stars";

/** slotKey -> ratings with mods. Absent: nothing yet. Empty: they couldn't be had. */
export type ModdedStarRatings = ReadonlyMap<string, readonly ModdedRating[]>;

export type StarRatingsFetcher = (query: string) => Promise<StarRatingsResponse>;

export type StarRatingsOptions = { delayMs?: number; fetchRatings?: StarRatingsFetcher };

/**
 * @function fetchStarRatings
 * @param query {string} comma-joined pairs, already canonical
 * @param options {{ baseUrl?: string; fetch?: (input: string) => Promise<Response> }} tests
 * @returns {Promise<StarRatingsResponse>} the route's answer
 * @throws {Error} (rejects) on a network error, a non-2xx, or an unreadable body
 */
export const fetchStarRatings = async (
  query: string,
  {
    // Absolute in the browser; Node's fetch (tests) rejects a bare path.
    baseUrl = globalThis.location?.origin ?? "",
    fetch: doFetch = (input: string) => globalThis.fetch(input),
  }: { baseUrl?: string; fetch?: (input: string) => Promise<Response> } = {},
): Promise<StarRatingsResponse> => {
  // ":" and "," are fine in a query string; leaving them unencoded keeps one URL per pool.
  const response = await doFetch(`${baseUrl}/api/osu/star-ratings?q=${query}`);
  if (!response.ok) throw new Error(`Star ratings answered ${response.status}.`);
  return starRatingsResponseSchema.parse(await response.json());
};

const defaultFetcher: StarRatingsFetcher = (query) => fetchStarRatings(query);

/**
 * @function useModdedStarRatings
 * @param slots {readonly PoolSlot[]} the pool
 * @param metaById {(beatmapId: number) => MetaState} metadata lookup (the ruleset decides freemod sets)
 * @param modsBySlot {ReadonlyMap<string, SlotMods>} slotKey -> what that slot plays with
 * @param options {StarRatingsOptions} delay before asking (editor), and the fetcher (tests)
 * @returns {ModdedStarRatings} slotKey -> ratings with mods, filling in as answers arrive
 */
export const useModdedStarRatings = (
  slots: readonly PoolSlot[],
  metaById: (beatmapId: number) => MetaState,
  modsBySlot: ReadonlyMap<string, SlotMods>,
  { delayMs = 0, fetchRatings = defaultFetcher }: StarRatingsOptions = {},
): ModdedStarRatings => {
  const [results, setResults] = useState<ReadonlyMap<string, StarPairResult>>(() => new Map());
  const resultsRef = useRef(results);
  resultsRef.current = results;
  const query = starPairsFor(slots, metaById, modsBySlot).join(",");

  useEffect(() => {
    if (query === "") return;
    const pairs = query.split(",");
    // Removing a slot changes the query but needs nothing new.
    if (pairs.every((pair) => typeof resultsRef.current.get(pair) === "number")) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const run = async () => {
      attempts++;
      const last = attempts > STAR_MAX_RETRIES;
      let ratings: Record<string, number> = {};
      let pending: ReadonlySet<string> = new Set(pairs);
      try {
        const body = await fetchRatings(query);
        ratings = body.ratings;
        pending = new Set(body.pending);
      } catch {
        // Offline or our route is down: treat every pair as still owed.
      }
      if (cancelled) return;
      setResults((prev) => {
        const next = new Map(prev);
        for (const pair of pairs) {
          const stars = ratings[pair];
          if (stars !== undefined) next.set(pair, stars);
          else if (last || !pending.has(pair)) next.set(pair, STAR_FAILED);
        }
        return next;
      });
      if (!last && pairs.some((pair) => ratings[pair] === undefined && pending.has(pair))) {
        timer = setTimeout(run, STAR_RETRY_MS);
      }
    };

    timer = setTimeout(run, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, delayMs, fetchRatings]);

  return useMemo(
    () => ratingsForSlots(slots, metaById, modsBySlot, results),
    [slots, metaById, modsBySlot, results],
  );
};

/**
 * @function usePoolStarRatings
 * @param pack {{ slots; buckets? }} the pool and its bucket list
 * @param metaById {(beatmapId: number) => MetaState} metadata lookup
 * @param options {StarRatingsOptions} passed to useModdedStarRatings
 * @returns {{ modsBySlot; ratings; starsOf }} each slot's mods, its ratings with mods, and the
 *          stars pack stats should count for it
 */
export const usePoolStarRatings = (
  pack: { slots: readonly PoolSlot[]; buckets?: readonly BucketEntry[] | undefined },
  metaById: (beatmapId: number) => MetaState,
  options: StarRatingsOptions = {},
): {
  modsBySlot: Map<string, SlotMods>;
  ratings: ModdedStarRatings;
  starsOf: (slot: PoolSlot, meta: BeatmapMeta) => number;
} => {
  const { slots, buckets } = pack;
  const modsBySlot = useMemo(() => slotModsMap(slots, bucketsOf({ buckets })), [slots, buckets]);
  const ratings = useModdedStarRatings(slots, metaById, modsBySlot, options);
  const starsOf = useMemo(() => moddedStarsOf(modsBySlot, ratings), [modsBySlot, ratings]);
  return { modsBySlot, ratings, starsOf };
};
