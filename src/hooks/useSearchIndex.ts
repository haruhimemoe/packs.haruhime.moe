/**
 * @file src/hooks/useSearchIndex.ts
 * @desc The public search index (/packs/index.json) as React state, loaded on demand: nothing is
 *       fetched until `load` is called, and a second call while it loads or after it arrived does
 *       nothing. After a failed load, `load` does nothing either (so typing or a slider drag can't
 *       refetch it on every change); only `retry` tries again.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { fetchSearchIndex } from "@/lib/search-index";
import type { SearchIndex } from "@/schemas/public-pack";

export type SearchIndexState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; index: SearchIndex }
  | { status: "error" };

export type SearchIndexHandle = {
  state: SearchIndexState;
  /** Failed loads in a row: 0 until one fails, and again once one succeeds. */
  failures: number;
  /** Starts loading once; does nothing while loading, once loaded, or after a failure. */
  load: () => void;
  /** Tries again after a failure (or starts a first load); does nothing while loading. */
  retry: () => void;
};

/**
 * @function useSearchIndex
 * @param loadIndex {() => Promise<SearchIndex>} how to fetch it (default: fetchSearchIndex)
 * @returns {SearchIndexHandle} the index's state, how many loads failed in a row, and stable
 *          `load` and `retry` functions
 */
export const useSearchIndex = (
  loadIndex: () => Promise<SearchIndex> = () => fetchSearchIndex(),
): SearchIndexHandle => {
  const [state, setState] = useState<SearchIndexState>({ status: "idle" });
  const [failures, setFailures] = useState(0);
  // Loading or loaded; and failed loads in a row, for the callbacks without a re-render.
  const started = useRef(false);
  const failed = useRef(0);
  // The latest loader, so `load` stays the same function across renders.
  const loader = useRef(loadIndex);
  loader.current = loadIndex;

  const start = useCallback(() => {
    started.current = true;
    setState({ status: "loading" });
    loader.current().then(
      (index) => {
        failed.current = 0;
        setFailures(0);
        setState({ status: "ready", index });
      },
      () => {
        started.current = false;
        failed.current += 1;
        setFailures(failed.current);
        setState({ status: "error" });
      },
    );
  }, []);

  const load = useCallback(() => {
    if (!started.current && failed.current === 0) start();
  }, [start]);

  const retry = useCallback(() => {
    if (!started.current) start();
  }, [start]);

  return { state, failures, load, retry };
};
