/**
 * @file src/hooks/usePackFilters.ts
 * @desc The /packs filters as React state kept in the URL. The first render has no filters (so
 *       the cached HTML matches); right after mount, and on every back or forward, they are read
 *       from the query string. Changes are written back with history.replaceState, so the page
 *       never scrolls or adds history entries, at most once per URL_WRITE_INTERVAL_MS with the
 *       last change always written.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { URL_WRITE_INTERVAL_MS } from "@/constants/pack-filters";
import { EMPTY_FILTERS, filtersHref, type PackFilters, parseFilters } from "@/utils/pack-filters";

/**
 * @function usePackFilters
 * @returns {[PackFilters, (next: PackFilters) => void]} the filters and a setter that also
 *          updates the URL
 */
export const usePackFilters = (): [PackFilters, (next: PackFilters) => void] => {
  const [filters, setFilters] = useState<PackFilters>(EMPTY_FILTERS);
  const latest = useRef(filters);
  const lastWrite = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  const write = useCallback(() => {
    pending.current = null;
    lastWrite.current = Date.now();
    try {
      const { pathname, search, hash } = window.location;
      const href = filtersHref(pathname, latest.current) + hash;
      if (href === pathname + search + hash) return;
      // null state: Next.js keeps its own router state and follows the new URL.
      window.history.replaceState(null, "", href);
    } catch {
      // The browser refused this write (too many too fast), or the URL couldn't be built; the
      // filters still apply, and the next change writes again.
    }
  }, []);

  useEffect(() => {
    const read = () => {
      const parsed = parseFilters(window.location.search);
      latest.current = parsed;
      setFilters(parsed);
    };
    read();
    window.addEventListener("popstate", read);
    return () => {
      window.removeEventListener("popstate", read);
      if (pending.current !== null) clearTimeout(pending.current);
    };
  }, []);

  const update = useCallback(
    (next: PackFilters) => {
      latest.current = next;
      setFilters(next);
      // A write is already waiting; it will take the latest filters.
      if (pending.current !== null) return;
      const wait = lastWrite.current + URL_WRITE_INTERVAL_MS - Date.now();
      if (wait <= 0) write();
      else pending.current = setTimeout(write, wait);
    },
    [write],
  );

  return [filters, update];
};
