/**
 * @file src/hooks/useBeatmapMeta.ts
 * @desc Loads metadata for a changing list of beatmap ids from the mirror, falling back to osu! for
 *       ids it doesn't know. Fetches only ids it has not resolved yet; failed ids, and ids osu!
 *       couldn't check yet (its budget spent), stay "error" until retry(). A lookup that's no longer
 *       wanted (ids changed, unmounted) is aborted. Metadata the server already rendered (a pack
 *       page) starts as found, so the first paint has map titles; it's still asked for once,
 *       without going back to loading, and kept when that refresh fails.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { useCallback, useEffect, useRef, useState } from "react";
import { type BeatmapSource, beatmapLookup } from "@/lib/beatmaps/lookup";
import { mirrorErrorText } from "@/lib/mirror";
import type { MetaState } from "@/schemas/beatmap-meta";

const LOADING: MetaState = { status: "loading" };
const FALLBACK_ERROR = "Something went wrong loading beatmaps. Try again.";
const UNCHECKED_ERROR = "osu! is busy right now. Try again in a minute.";

const withAll = (
  prev: ReadonlyMap<number, MetaState>,
  ids: readonly number[],
  state: MetaState,
) => {
  const next = new Map(prev);
  for (const id of ids) next.set(id, state);
  return next;
};

const seededEntries = (initial: readonly BeatmapMeta[]): ReadonlyMap<number, MetaState> =>
  new Map(initial.map((meta) => [meta.beatmapId, { status: "found", meta }]));

/**
 * @function useBeatmapMeta
 * @param ids {readonly number[]} beatmap (difficulty) ids currently shown
 * @param client {BeatmapSource} injectable for tests; defaults to hinai with the osu! fallback
 * @param initial {readonly BeatmapMeta[]} metadata the server rendered with: shown as found at
 *        once, then refreshed in the background (only read on the first render)
 * @returns {{ get(id): MetaState; hasErrors: boolean; retry(): void }}
 */
export const useBeatmapMeta = (
  ids: readonly number[],
  client: BeatmapSource = beatmapLookup,
  initial: readonly BeatmapMeta[] = [],
) => {
  const [entries, setEntries] = useState<ReadonlyMap<number, MetaState>>(() =>
    seededEntries(initial),
  );
  const [attempt, setAttempt] = useState(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;
  // Server-rendered ids not refreshed yet.
  const stale = useRef<Set<number> | null>(null);
  stale.current ??= new Set(initial.map((meta) => meta.beatmapId));

  const idsKey = [...new Set(ids)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    void attempt;
    const wanted = idsKey === "" ? [] : idsKey.split(",").map(Number);
    const refreshing = stale.current ?? new Set<number>();
    const pending = wanted.filter((id) => {
      const state = entriesRef.current.get(id);
      return (
        state === undefined ||
        state.status === "loading" ||
        state.status === "error" ||
        refreshing.has(id)
      );
    });
    if (pending.length === 0) return;

    let cancelled = false;
    let settled = false;
    const controller = new AbortController();
    const refreshed = pending.filter((id) => refreshing.has(id));
    for (const id of refreshed) refreshing.delete(id);
    // A refresh of a found map keeps it on screen: only unknown ids go back to loading.
    const unknown = (prev: ReadonlyMap<number, MetaState>) =>
      pending.filter((id) => prev.get(id)?.status !== "found");
    setEntries((prev) => withAll(prev, unknown(prev), LOADING));
    client
      .getBeatmaps(pending, { signal: controller.signal })
      .then(({ found, missing, unchecked = [] }) => {
        settled = true;
        if (cancelled) return;
        setEntries((prev) => {
          const next = new Map(prev);
          for (const [id, meta] of found) next.set(id, { status: "found", meta });
          for (const id of missing) next.set(id, { status: "missing" });
          for (const id of unchecked) {
            if (prev.get(id)?.status !== "found") {
              next.set(id, { status: "error", message: UNCHECKED_ERROR });
            }
          }
          return next;
        });
      })
      .catch((error: unknown) => {
        settled = true;
        if (cancelled) return;
        const message = mirrorErrorText(error, FALLBACK_ERROR);
        setEntries((prev) => withAll(prev, unknown(prev), { status: "error", message }));
      });
    return () => {
      cancelled = true;
      controller.abort();
      // Cut short (ids changed, a dev remount): the server's copy still wants its refresh.
      if (!settled) for (const id of refreshed) refreshing.add(id);
    };
  }, [idsKey, attempt, client]);

  const get = useCallback((id: number): MetaState => entries.get(id) ?? LOADING, [entries]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const hasErrors = ids.some((id) => entries.get(id)?.status === "error");

  return { get, hasErrors, retry };
};

export type BeatmapMetaApi = ReturnType<typeof useBeatmapMeta>;
