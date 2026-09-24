/**
 * @file src/hooks/useMapUsage.ts
 * @desc Map usage for a pool's maps (pool archive spec, part 2): asks
 *       /api/v1/beatmaps/usage once for every map it doesn't know yet, ids sorted so every viewer
 *       of a pack shares one CDN-cached URL (after a delay in the editor), and keeps the answers
 *       while the pool changes. A pack's own entries are left out. Usage is extra: a failed
 *       lookup shows nothing, and the next change to the pool asks again.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MAX_USAGE_IDS } from "@/constants/map-usage";
import {
  type BeatmapUsageList,
  beatmapUsageListSchema,
  type MapUsageEntry,
} from "@/schemas/map-usage";
import { usageElsewhere } from "@/utils/map-usage";

export type MapUsageFetcher = (ids: readonly number[]) => Promise<BeatmapUsageList>;

export type MapUsageOptions = {
  /** The pack being shown: its own entries are left out. */
  excludeSlug?: string | undefined;
  /** Wait this long after the pool changes before asking (the editor). */
  delayMs?: number;
  /** Test seam. Default: fetchMapUsage. */
  fetchUsage?: MapUsageFetcher;
};

/**
 * @function fetchMapUsage
 * @param ids {readonly number[]} 1 to MAX_USAGE_IDS beatmap ids, in the order to ask
 * @param options {{ baseUrl?: string; fetch?: (input: string) => Promise<Response> }} tests
 * @returns {Promise<BeatmapUsageList>} the route's answer
 * @throws {Error} (rejects) on a network error, a non-2xx, or an unreadable body
 */
export const fetchMapUsage = async (
  ids: readonly number[],
  {
    // Absolute in the browser; Node's fetch (tests) rejects a bare path.
    baseUrl = globalThis.location?.origin ?? "",
    fetch: doFetch = (input: string) => globalThis.fetch(input),
  }: { baseUrl?: string; fetch?: (input: string) => Promise<Response> } = {},
): Promise<BeatmapUsageList> => {
  const response = await doFetch(`${baseUrl}/api/v1/beatmaps/usage?ids=${ids.join(",")}`);
  if (!response.ok) throw new Error(`Map usage answered ${response.status}.`);
  return beatmapUsageListSchema.parse(await response.json());
};

const defaultFetcher: MapUsageFetcher = (ids) => fetchMapUsage(ids);

const NONE: readonly MapUsageEntry[] = [];

/**
 * @function useMapUsage
 * @param ids {readonly number[]} the pool's beatmap ids, in any order, repeats allowed
 * @param options {MapUsageOptions} the pack to leave out, the delay, and the fetcher (tests)
 * @returns {(beatmapId: number) => readonly MapUsageEntry[]} a map's entries from other packs;
 *          empty until its answer arrives, and for a map no other archive pool used
 */
export const useMapUsage = (
  ids: readonly number[],
  { excludeSlug, delayMs = 0, fetchUsage = defaultFetcher }: MapUsageOptions = {},
): ((beatmapId: number) => readonly MapUsageEntry[]) => {
  const [known, setKnown] = useState<ReadonlyMap<number, readonly MapUsageEntry[]>>(
    () => new Map(),
  );
  const knownRef = useRef(known);
  knownRef.current = known;
  // One canonical list per pool: sorted, each id once.
  const wanted = useMemo(() => [...new Set(ids)].sort((a, b) => a - b).join(","), [ids]);

  useEffect(() => {
    if (wanted === "") return;
    // Removing a map, or reordering the pool, needs nothing new.
    const missing = wanted
      .split(",")
      .map(Number)
      .filter((id) => !knownRef.current.has(id));
    if (missing.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const batches: number[][] = [];
      for (let at = 0; at < missing.length; at += MAX_USAGE_IDS) {
        batches.push(missing.slice(at, at + MAX_USAGE_IDS));
      }
      try {
        // A pack (at most MAX_SLOTS maps) is always one request.
        const answers = await Promise.all(batches.map((batch) => fetchUsage(batch)));
        if (cancelled) return;
        setKnown((prev) => {
          const next = new Map(prev);
          for (const id of missing) next.set(id, NONE);
          for (const usage of answers.flatMap((answer) => answer.beatmaps)) {
            next.set(usage.beatmapId, usage.entries);
          }
          return next;
        });
      } catch {
        // Usage is extra: nothing shows, and the next change to the pool asks again.
      }
    }, delayMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [wanted, delayMs, fetchUsage]);

  return useCallback(
    (beatmapId: number) => usageElsewhere(known.get(beatmapId) ?? NONE, excludeSlug),
    [known, excludeSlug],
  );
};
