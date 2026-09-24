/**
 * @file src/hooks/useSearchIndex.ts
 * @desc The public search index (/packs/index.json) as React state, loaded on demand: nothing is
 *       fetched until `load` is called, a second call while it loads or after it arrived does
 *       nothing, and a failed load lets the next call try again.
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

/**
 * @function useSearchIndex
 * @param loadIndex {() => Promise<SearchIndex>} how to fetch it (default: fetchSearchIndex)
 * @returns {{ state: SearchIndexState; load: () => void }} the index's state and a stable
 *          function that starts loading it once
 */
export const useSearchIndex = (
  loadIndex: () => Promise<SearchIndex> = () => fetchSearchIndex(),
): { state: SearchIndexState; load: () => void } => {
  const [state, setState] = useState<SearchIndexState>({ status: "idle" });
  const started = useRef(false);
  // The latest loader, so `load` stays the same function across renders.
  const loader = useRef(loadIndex);
  loader.current = loadIndex;

  const load = useCallback(() => {
    if (started.current) return;
    started.current = true;
    setState({ status: "loading" });
    loader.current().then(
      (index) => setState({ status: "ready", index }),
      () => {
        // Let the next call try again.
        started.current = false;
        setState({ status: "error" });
      },
    );
  }, []);

  return { state, load };
};
