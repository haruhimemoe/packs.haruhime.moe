/**
 * @file src/hooks/useSearchIndex.ts
 * @desc The public search index (/packs/index.json) as React state, loaded on demand: nothing is
 *       fetched until `load` is called, and a second call while it loads or after it arrived does
 *       nothing. After a failed load, `load` does nothing either (so typing or a slider drag can't
 *       refetch it on every change); only `retry` tries again. A loaded index is kept for the tab
 *       for INDEX_REUSE_MS, so coming back to /packs has it on the first render.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useCallback, useRef, useState } from "react";
import { INDEX_REUSE_MS } from "@/constants/pack-filters";
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

type LoadIndex = () => Promise<SearchIndex>;

const fetchIndex: LoadIndex = () => fetchSearchIndex();

/** Indexes loaded in this tab, by loader, with when they arrived. Only successes are kept. */
const kept = new WeakMap<LoadIndex, { index: SearchIndex; at: number }>();

/** The index this loader brought within INDEX_REUSE_MS, or null. */
const keptIndex = (loadIndex: LoadIndex): SearchIndex | null => {
  const hit = kept.get(loadIndex);
  return hit && Date.now() - hit.at <= INDEX_REUSE_MS ? hit.index : null;
};

/**
 * @function useSearchIndex
 * @param loadIndex {() => Promise<SearchIndex>} how to fetch it (default: fetchSearchIndex). Keep
 *        it the same function across renders: the kept index is looked up by it.
 * @returns {SearchIndexHandle} the index's state (ready at once when this tab loaded it lately),
 *          how many loads failed in a row, and stable `load` and `retry` functions
 */
export const useSearchIndex = (loadIndex: LoadIndex = fetchIndex): SearchIndexHandle => {
  const [state, setState] = useState<SearchIndexState>(() => {
    const index = keptIndex(loadIndex);
    return index ? { status: "ready", index } : { status: "idle" };
  });
  const [failures, setFailures] = useState(0);
  // Loading or loaded; and failed loads in a row, for the callbacks without a re-render.
  const started = useRef(state.status === "ready");
  const failed = useRef(0);
  // The latest loader, so `load` stays the same function across renders.
  const loader = useRef(loadIndex);
  loader.current = loadIndex;

  const start = useCallback(() => {
    started.current = true;
    setState({ status: "loading" });
    const from = loader.current;
    from().then(
      (index) => {
        kept.set(from, { index, at: Date.now() });
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
