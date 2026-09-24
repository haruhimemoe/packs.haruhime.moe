/**
 * @file src/hooks/usePackListView.ts
 * @desc How many filtered /packs results show, remembered for Back and Forward: while results
 *       are on screen, the count and the scroll position are saved (on scroll, at most every
 *       LIST_VIEW_SAVE_MS, and on any link click, before the page is left). A mount that is a
 *       back or forward to its URL starts with that count and, once the results are on screen,
 *       scrolls back to that place. Any other visit starts with the first results at the top.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FILTER_RESULTS_STEP, LIST_VIEW_SAVE_MS } from "@/constants/pack-filters";
import {
  cameBackTo,
  forgetTraversal,
  type ListView,
  loadListView,
  saveListView,
  watchTraversals,
} from "@/lib/storage/pack-list-view";

/** The page's path and query, as views are keyed. */
const hereHref = (): string => window.location.pathname + window.location.search;

/** The view saved for this URL when this mount is a back or forward to it; null otherwise. */
const viewToRestore = (): ListView | null =>
  typeof window !== "undefined" && cameBackTo(hereHref()) ? loadListView(hereHref()) : null;

/**
 * @function usePackListView
 * @param ready {boolean} whether results are on screen (browsing, and the index is in)
 * @returns {[number, (next: number) => void]} how many results to show, and a setter (any
 *          change also drops a scroll-back that hasn't happened yet: the reader moved on)
 */
export const usePackListView = (ready: boolean): [number, (next: number) => void] => {
  const [restore] = useState(viewToRestore);
  const [shown, setShownState] = useState(restore?.shown ?? FILTER_RESULTS_STEP);
  const scrollBack = useRef(restore?.y ?? null);
  const current = useRef(shown);
  current.current = shown;

  useEffect(() => {
    watchTraversals();
    // Used by this mount; a later visit to the same URL is a fresh one.
    forgetTraversal();
  }, []);

  // Back at the results: scroll to where the reader was, once, before the page paints.
  useLayoutEffect(() => {
    if (!ready || scrollBack.current === null) return;
    window.scrollTo(0, scrollBack.current);
    scrollBack.current = null;
  }, [ready]);

  const save = useCallback(() => {
    saveListView(hereHref(), { shown: current.current, y: window.scrollY });
  }, []);

  useEffect(() => {
    if (!ready) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const onScroll = () => {
      timer ??= setTimeout(() => {
        timer = null;
        save();
      }, LIST_VIEW_SAVE_MS);
    };
    // Leaving by a link (a card, the header): keep the place before the page goes.
    const onClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a[href]")) save();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick, true);
      if (timer !== null) clearTimeout(timer);
    };
  }, [ready, save]);

  const setShown = useCallback((next: number) => {
    scrollBack.current = null;
    setShownState(next);
  }, []);

  return [shown, setShown];
};
