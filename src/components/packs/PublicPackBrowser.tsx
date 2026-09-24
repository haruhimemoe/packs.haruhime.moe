/**
 * @file src/components/packs/PublicPackBrowser.tsx
 * @desc /packs in the browser: the filter bar over the server-rendered list. With no search,
 *       filter or sort (the plain /packs URL), the cached list (children) shows and nothing is
 *       fetched. Anything else loads /packs/index.json once and filters and sorts it here,
 *       50 cards at a time. The filters live in the URL (usePackFilters) and follow it when it
 *       changes under the page (back, forward, or a link here). Coming back with Back or Forward
 *       shows as many results as before, at the same place (usePackListView), and a remount
 *       reuses the index this tab already loaded. The result count
 *       follows every change on screen but is announced only once changes settle. An empty
 *       result says what might help (other words, a wider range, or clearing the stat filters
 *       while stats are still being worked out). If the index can't load, the server list
 *       stays: an alert says so once, and only its "Try again" button fetches the index again.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { Button } from "@haruhimemoe/ui";
import { type ReactNode, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PackFilterBar } from "@/components/packs/PackFilterBar";
import { PublicPackList } from "@/components/packs/PublicPackList";
import { SearchParamsWatcher } from "@/components/packs/SearchParamsWatcher";
import { COUNT_SETTLE_MS, FILTER_RESULTS_STEP } from "@/constants/pack-filters";
import { usePackFilters } from "@/hooks/usePackFilters";
import { usePackListView } from "@/hooks/usePackListView";
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
  const { filters, setFilters, followUrl, urlReads } = usePackFilters();
  const { state, failures, load, retry } = useSearchIndex(loadIndex);
  const list = useRef<HTMLDivElement>(null);
  // After "Show more", the first new card to move focus to.
  const focusFrom = useRef<number | null>(null);
  const browsing = isBrowsing(filters);

  // Filters read from the URL (on load, back, forward, or a link here) need the index too.
  useEffect(() => {
    if (browsing) load();
  }, [browsing, load]);

  const update = (next: PackFilters) => {
    setFilters(next);
    setShown(FILTER_RESULTS_STEP);
    // After a failed load this does nothing: only "Try again" refetches.
    if (isBrowsing(next)) load();
  };

  // A load failed and none has worked since (a retry may be running).
  const failed = failures > 0 && state.status !== "ready";
  const retrying = failed && state.status === "loading";

  // Fold the whole index once when it arrives, not on every change.
  const prepared = useMemo(
    () => (state.status === "ready" ? prepareSearchIndex(state.index.packs) : []),
    [state],
  );
  const result = useMemo(
    () => (browsing && state.status === "ready" ? filterPacks(prepared, filters) : null),
    [browsing, state.status, prepared, filters],
  );
  // Back to these results: as many as before, at the same place (usePackListView).
  const [shown, setShown] = usePackListView(
    !failed && result !== null && result.entries.length > 0,
  );
  // Filters read from the URL (back, forward, a link here) start from the first results too.
  const [seenUrlReads, setSeenUrlReads] = useState(urlReads);
  if (seenUrlReads !== urlReads) {
    setSeenUrlReads(urlReads);
    setShown(FILTER_RESULTS_STEP);
  }

  useEffect(() => {
    if (focusFrom.current === null) return;
    const links = list.current?.querySelectorAll<HTMLAnchorElement>("li a");
    links?.[focusFrom.current]?.focus();
    focusFrom.current = null;
  });

  const q = filters.q.trim();
  const filtered = hasFilters(filters);
  let count = "";
  if (browsing && state.status === "loading" && !failed) count = "Loading packs…";
  else if (result) count = describeResults(result.entries.length, result.hidden, q, filtered);
  // Announce where a drag or a burst of typing ends up, not every step.
  const settledCount = useSettledValue(count, COUNT_SETTLE_MS);

  let body: ReactNode = children;
  // After a failure the server list stays, a background retry included.
  if (browsing && !failed) {
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
      <Suspense fallback={null}>
        <SearchParamsWatcher onChange={followUrl} />
      </Suspense>
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
      {/* Always mounted, so only a change of text is announced; empty, it takes no space. */}
      <p role="alert" className="text-rose-300 text-sm empty:sr-only">
        {browsing && failed
          ? failures === 1
            ? "Search and filters aren't available right now."
            : "Search and filters still aren't available. Try again in a minute."
          : ""}
      </p>
      {browsing && failed ? (
        <div>
          <Button variant="secondary" onClick={retry} disabled={retrying}>
            {retrying ? "Trying again…" : "Try again"}
          </Button>
        </div>
      ) : null}
      {body}
    </div>
  );
}
