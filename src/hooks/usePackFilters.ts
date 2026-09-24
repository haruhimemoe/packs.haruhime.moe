/**
 * @file src/hooks/usePackFilters.ts
 * @desc The /packs filters as React state kept in the URL. Hydrating the cached HTML, the first
 *       render has no filters (so it matches), and they are read from the query string right
 *       after mount; any other mount (coming back to the page) reads them on its first render.
 *       They are read again whenever the URL changes under the page: back and forward, or a
 *       link to this page (followUrl, which the page calls when the router's query changes).
 *       Changes are written back with history.replaceState, so the page never scrolls or adds
 *       history entries, at most once per URL_WRITE_INTERVAL_MS with the last change always
 *       written. A URL this hook wrote itself is never read back as a change.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { URL_WRITE_INTERVAL_MS } from "@/constants/pack-filters";
import {
  EMPTY_FILTERS,
  filtersHref,
  type PackFilters,
  parseFilters,
  serializeFilters,
} from "@/utils/pack-filters";

export type PackFiltersHandle = {
  filters: PackFilters;
  /** Sets the filters and writes them to the URL (throttled). */
  setFilters: (next: PackFilters) => void;
  /** Reads the filters from the URL again if it changed under the page; stable. */
  followUrl: () => void;
  /** How many times the filters were taken from the URL rather than set on the page. */
  urlReads: number;
};

const subscribeNothing = () => () => {};

/**
 * @function usePackFilters
 * @returns {PackFiltersHandle} the filters, a setter that also updates the URL, the function
 *          that follows URL changes made elsewhere, and how many times it took filters from them
 */
export const usePackFilters = (): PackFiltersHandle => {
  // False only while hydrating (and on the server), where the HTML was built without filters.
  const mountedOnClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false,
  );
  const [filters, setFilterState] = useState<PackFilters>(() =>
    mountedOnClient ? parseFilters(window.location.search) : EMPTY_FILTERS,
  );
  const [urlReads, setUrlReads] = useState(0);
  const latest = useRef(filters);
  // The query the URL holds as far as this hook knows: the last one it read or wrote.
  const known = useRef(serializeFilters(filters));
  const lastWrite = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const write = useCallback(() => {
    pending.current = null;
    lastWrite.current = Date.now();
    try {
      const { pathname, search, hash } = window.location;
      const href = filtersHref(pathname, latest.current) + hash;
      // null state: Next.js keeps its own router state and follows the new URL.
      if (href !== pathname + search + hash) window.history.replaceState(null, "", href);
      known.current = serializeFilters(latest.current);
    } catch {
      // The browser refused this write (too many too fast), or the URL couldn't be built; the
      // filters still apply, and the next change writes again.
    }
  }, []);

  const followUrl = useCallback(() => {
    const parsed = parseFilters(window.location.search);
    const search = serializeFilters(parsed);
    // The URL this hook last read or wrote (the router catching up with a write, say).
    if (search === known.current) return;
    known.current = search;
    // A write still waiting would put the old filters back over the new URL.
    if (pending.current !== null) {
      clearTimeout(pending.current);
      pending.current = null;
    }
    latest.current = parsed;
    setFilterState(parsed);
    setUrlReads((reads) => reads + 1);
  }, []);

  useEffect(() => {
    followUrl();
    window.addEventListener("popstate", followUrl);
    return () => {
      window.removeEventListener("popstate", followUrl);
      if (pending.current !== null) clearTimeout(pending.current);
    };
  }, [followUrl]);

  const setFilters = useCallback(
    (next: PackFilters) => {
      latest.current = next;
      setFilterState(next);
      // A write is already waiting; it will take the latest filters.
      if (pending.current !== null) return;
      const wait = lastWrite.current + URL_WRITE_INTERVAL_MS - Date.now();
      if (wait <= 0) write();
      else pending.current = setTimeout(write, wait);
    },
    [write],
  );

  return { filters, setFilters, followUrl, urlReads };
};
