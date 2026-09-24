/**
 * @file src/hooks/useBeatmapMeta.ts
 * @desc Loads metadata for a changing list of beatmap ids from the mirror, falling back to osu! for
 *       ids it doesn't know. Fetches only ids it has not resolved yet; failed ids, and ids osu!
 *       couldn't check yet (its budget spent), stay "error" until retry(). A lookup that's no longer
 *       wanted (ids changed, unmounted) is aborted.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MetaState } from "@/hooks/beatmapMetaState";
import { type BeatmapSource, beatmapLookup } from "@/lib/beatmaps/lookup";
import { mirrorErrorText } from "@/lib/mirror";

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

/**
 * @function useBeatmapMeta
 * @param ids {readonly number[]} beatmap (difficulty) ids currently shown
 * @param client {BeatmapSource} injectable for tests; defaults to hinai with the osu! fallback
 * @returns {{ get(id): MetaState; hasErrors: boolean; retry(): void }}
 */
export const useBeatmapMeta = (ids: readonly number[], client: BeatmapSource = beatmapLookup) => {
  const [entries, setEntries] = useState<ReadonlyMap<number, MetaState>>(() => new Map());
  const [attempt, setAttempt] = useState(0);
  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const idsKey = [...new Set(ids)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    void attempt;
    const wanted = idsKey === "" ? [] : idsKey.split(",").map(Number);
    const pending = wanted.filter((id) => {
      const state = entriesRef.current.get(id);
      return state === undefined || state.status === "loading" || state.status === "error";
    });
    if (pending.length === 0) return;

    let cancelled = false;
    const controller = new AbortController();
    setEntries((prev) => withAll(prev, pending, LOADING));
    client
      .getBeatmaps(pending, { signal: controller.signal })
      .then(({ found, missing, unchecked = [] }) => {
        if (cancelled) return;
        setEntries((prev) => {
          const next = new Map(prev);
          for (const [id, meta] of found) next.set(id, { status: "found", meta });
          for (const id of missing) next.set(id, { status: "missing" });
          for (const id of unchecked) {
            next.set(id, { status: "error", message: UNCHECKED_ERROR });
          }
          return next;
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const message = mirrorErrorText(error, FALLBACK_ERROR);
        setEntries((prev) => withAll(prev, pending, { status: "error", message }));
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [idsKey, attempt, client]);

  const get = useCallback((id: number): MetaState => entries.get(id) ?? LOADING, [entries]);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const hasErrors = ids.some((id) => entries.get(id)?.status === "error");

  return { get, hasErrors, retry };
};

export type BeatmapMetaApi = ReturnType<typeof useBeatmapMeta>;
