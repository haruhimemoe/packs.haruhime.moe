/**
 * @file src/hooks/useMapUsage.ts
 * @desc Map usage for a pool's maps (pool archive spec, part 2): asks
 *       /api/v1/beatmaps/usage once for every map it doesn't know yet, ids sorted so every viewer
 *       of a pack shares one CDN-cached URL, and keeps the answers while the pool changes. The
 *       first ask goes out at once; in the editor, later ones wait for the pool to hold still.
 *       An answer that lands after the pool changed is kept (answers are by beatmap id), and ids
 *       whose answer is on its way aren't asked for again. The pack's own entries are left out,
 *       and so is the pool shown, by its fingerprint (SHA-256 of fingerprintText, as the
 *       importer works it out), so a key or a copy of an archive pool doesn't count itself. A pack's own entries are left out. Usage is extra: a failed
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
import type { BucketEntry, PoolSlot } from "@/schemas/pack";
import { fingerprintText, usageElsewhere } from "@/utils/map-usage";

export type MapUsageFetcher = (ids: readonly number[]) => Promise<BeatmapUsageList>;

export type MapUsageOptions = {
  /** The pack being shown: its own entries are left out. */
  excludeSlug?: string | undefined;
  /** The pool being shown: entries of the pool with its fingerprint are left out too (a key or
   *  a copy of an archive pool is that pool). Nothing shows until the fingerprint is known. */
  pool?: { slots: readonly PoolSlot[]; buckets?: readonly BucketEntry[] | undefined };
  /** Test seam: sha256 of a text, lowercase hex. Default: crypto.subtle. */
  hash?: (text: string) => Promise<string>;
  /** Wait this long after the pool changes before asking (the editor). The first ask, for the
   *  pool it opens with, never waits. */
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

/** SHA-256 of a text as lowercase hex, as the importer's fingerprints are. */
const sha256Hex = async (text: string): Promise<string> => {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const NONE: readonly MapUsageEntry[] = [];

/**
 * @function useMapUsage
 * @param ids {readonly number[]} the pool's beatmap ids, in any order, repeats allowed
 * @param options {MapUsageOptions} the pack and pool to leave out, the delay, and the fetcher
 *        and hash (tests)
 * @returns {(beatmapId: number) => readonly MapUsageEntry[]} a map's entries from other pools;
 *          empty until its answer (and the pool's fingerprint) arrives, and for a map no other
 *          archive pool used
 */
export const useMapUsage = (
  ids: readonly number[],
  {
    excludeSlug,
    pool,
    delayMs = 0,
    fetchUsage = defaultFetcher,
    hash = sha256Hex,
  }: MapUsageOptions = {},
): ((beatmapId: number) => readonly MapUsageEntry[]) => {
  const [known, setKnown] = useState<ReadonlyMap<number, readonly MapUsageEntry[]>>(
    () => new Map(),
  );
  const knownRef = useRef(known);
  knownRef.current = known;
  // The pool a page opens with is asked for at once; only later changes wait.
  const askedRef = useRef(false);
  // Ids asked for and not answered yet: never asked for twice while their answer is on its way.
  const inFlightRef = useRef(new Set<number>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  // One canonical list per pool: sorted, each id once.
  const wanted = useMemo(() => [...new Set(ids)].sort((a, b) => a - b).join(","), [ids]);
  // The shown pool's fingerprint. While a changed pool's is worked out, the last one stands;
  // "" when it can't be (no crypto.subtle): then nothing is left out by fingerprint.
  const printText = useMemo(() => (pool ? fingerprintText(pool) : null), [pool]);
  const [print, setPrint] = useState<string | null>(null);
  useEffect(() => {
    if (printText === null) return;
    let live = true;
    hash(printText).then(
      (value) => {
        if (live) setPrint(value);
      },
      () => {
        if (live) setPrint("");
      },
    );
    return () => {
      live = false;
    };
  }, [printText, hash]);
  const printReady = printText === null || print !== null;

  useEffect(() => {
    if (wanted === "") return;
    // Removing a map, or reordering the pool, needs nothing new.
    const missing = wanted
      .split(",")
      .map(Number)
      .filter((id) => !knownRef.current.has(id) && !inFlightRef.current.has(id));
    if (missing.length === 0) return;
    const timer = setTimeout(
      async () => {
        askedRef.current = true;
        for (const id of missing) inFlightRef.current.add(id);
        const batches: number[][] = [];
        for (let at = 0; at < missing.length; at += MAX_USAGE_IDS) {
          batches.push(missing.slice(at, at + MAX_USAGE_IDS));
        }
        try {
          // A pack (at most MAX_SLOTS maps) is always one request.
          const answers = await Promise.all(batches.map((batch) => fetchUsage(batch)));
          // Answers are by beatmap id, so one that lands after the pool changed still holds.
          if (!mountedRef.current) return;
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
        } finally {
          for (const id of missing) inFlightRef.current.delete(id);
        }
      },
      askedRef.current ? delayMs : 0,
    );
    // A change only cancels an ask still waiting for its delay, never one on its way.
    return () => clearTimeout(timer);
  }, [wanted, delayMs, fetchUsage]);

  return useCallback(
    (beatmapId: number) =>
      printReady
        ? usageElsewhere(known.get(beatmapId) ?? NONE, {
            slug: excludeSlug,
            ...(print ? { fingerprint: print } : {}),
          })
        : NONE,
    [known, excludeSlug, print, printReady],
  );
};
