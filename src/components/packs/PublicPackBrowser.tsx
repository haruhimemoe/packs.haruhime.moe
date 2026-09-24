/**
 * @file src/components/packs/PublicPackBrowser.tsx
 * @desc /packs in the browser: the filter bar over the server-rendered list. With no search,
 *       filter or sort (the plain /packs URL), the cached list (children) shows and nothing is
 *       fetched. Anything else loads /packs/index.json once and filters and sorts it here,
 *       50 cards at a time. The filters live in the URL (usePackFilters), the result count
 *       follows every change on screen but is announced only once changes settle, an empty result says what might help (other words, a
 *       wider range, or clearing the stat filters while stats are still being worked out), and
 *       if the index can't load the server list stays.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { PackFilterBar } from "@/components/packs/PackFilterBar";
import { PublicPackList } from "@/components/packs/PublicPackList";
import { COUNT_SETTLE_MS, FILTER_RESULTS_STEP } from "@/constants/pack-filters";
import { usePackFilters } from "@/hooks/usePackFilters";
import { useSearchIndex } from "@/hooks/useSearchIndex";
import { useSettledValue } from "@/hooks/useSettledValue";
import { indexEntryToCard } from "@/lib/search-index";
import type { SearchIndex } from "@/schemas/public-pack";
import { filterPacks, hasFilters, isBrowsing, type PackFilters } from "@/utils/pack-filters";
import { prepareSearchIndex } from "@/utils/search";

type PublicPackBrowserProps = {
  /** The server-rendered list, shown while nothing is searched, filtered or sorted. */
  children: ReactNode;
  loadIndex?: () => Promise<SearchIndex>;
};

/** What nothing matched: the text, the filter rows, both, or neither (a sort alone). */
const noMatch = (q: string, filtered: boolean): string => {
  if (q !== "" && filtered) return `No packs match “${q}” with these filters.`;
  if (q !== "") return `No packs match “${q}”.`;
  return filtered ? "No packs match these filters." : "No public packs yet.";
};

/** "3 packs match. 1 pack is hidden until its stats are ready." */
const describeResults = (count: number, hidden: number, q: string, filtered: boolean): string => {
  const found =
    count === 0
      ? noMatch(q, filtered)
      : `${count} ${count === 1 ? "pack matches" : "packs match"}.`;
  if (hidden === 0) return found;
  return `${found} ${
    hidden === 1
      ? "1 pack is hidden until its stats are ready."
      : `${hidden} packs are hidden until their stats are ready.`
  }`;
};

/** What to try when nothing matches, or null when nothing would help (a sort alone). */
const noMatchHint = (hidden: number, q: string, filtered: boolean): string | null => {
  if (hidden > 0) {
    return hidden === 1
      ? "That pack's stats are still being worked out. Clear the star rating, mod, length, BPM and mode filters to see it."
      : "Those packs' stats are still being worked out. Clear the star rating, mod, length, BPM and mode filters to see them.";
  }
  if (filtered) {
    return q === ""
      ? "Try a wider range or fewer mods or modes."
      : "Try a wider range, fewer mods or modes, or other words.";
  }
  return q === "" ? null : "Try other words.";
};

export function PublicPackBrowser({ children, loadIndex }: PublicPackBrowserProps) {
  const [filters, setFilters] = usePackFilters();
  const { state, load } = useSearchIndex(loadIndex);
  const [shown, setShown] = useState(FILTER_RESULTS_STEP);
  const list = useRef<HTMLDivElement>(null);
  // After "Show more", the first new card to move focus to.
  const focusFrom = useRef<number | null>(null);
  const browsing = isBrowsing(filters);

  // Filters read from the URL (on load, back or forward) need the index too.
  useEffect(() => {
    if (browsing) load();
  }, [browsing, load]);

  const update = (next: PackFilters) => {
    setFilters(next);
    setShown(FILTER_RESULTS_STEP);
    // Also retries after a failed load.
    if (isBrowsing(next)) load();
  };

  // Fold the whole index once when it arrives, not on every change.
  const prepared = useMemo(
    () => (state.status === "ready" ? prepareSearchIndex(state.index.packs) : []),
    [state],
  );
  const result = useMemo(
    () => (browsing && state.status === "ready" ? filterPacks(prepared, filters) : null),
    [browsing, state.status, prepared, filters],
  );

  useEffect(() => {
    if (focusFrom.current === null) return;
    const links = list.current?.querySelectorAll<HTMLAnchorElement>("li a");
    links?.[focusFrom.current]?.focus();
    focusFrom.current = null;
  });

  const q = filters.q.trim();
  const filtered = hasFilters(filters);
  let count = "";
  if (browsing && state.status === "loading") count = "Loading packs…";
  else if (result) count = describeResults(result.entries.length, result.hidden, q, filtered);
  // Announce where a drag or a burst of typing ends up, not every step.
  const settledCount = useSettledValue(count, COUNT_SETTLE_MS);

  let body: ReactNode = children;
  if (browsing && state.status !== "error") {
    if (result === null) {
      body = <p className="text-c4 text-sm">Loading packs…</p>;
    } else if (result.entries.length === 0) {
      const hint = noMatchHint(result.hidden, q, filtered);
      body = hint ? <p className="text-c3">{hint}</p> : null;
    } else {
      body = (
        <div ref={list} className="flex flex-col items-center gap-4">
          <div className="w-full">
            <PublicPackList
              packs={result.entries.slice(0, shown).map(indexEntryToCard)}
              date={filters.sort === "updated" ? "updated" : "added"}
            />
          </div>
          {result.entries.length > shown ? (
            <Button
              variant="secondary"
              onClick={() => {
                focusFrom.current = shown;
                setShown(shown + FILTER_RESULTS_STEP);
              }}
            >
              Show more
            </Button>
          ) : null}
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PackFilterBar
        filters={filters}
        onChange={update}
        onSearchFocus={load}
        resultCount={
          // People see every change; screen readers hear only where a drag or burst of typing
          // ends up (changes inside aria-hidden text aren't announced).
          <>
            <span aria-hidden="true">{count}</span>
            <span className="sr-only">{settledCount}</span>
          </>
        }
      />
      {browsing && state.status === "error" ? (
        <p role="alert" className="text-rose-300 text-sm">
          Search and filters aren't available right now. Try again later.
        </p>
      ) : null}
      {body}
    </div>
  );
}
