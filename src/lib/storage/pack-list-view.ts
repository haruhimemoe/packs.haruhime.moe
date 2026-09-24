/**
 * @file src/lib/storage/pack-list-view.ts
 * @desc Where someone was in the filtered /packs results, so Back (or Forward) to them puts them
 *       there again: how many results showed and the scroll position, per URL, in the tab's
 *       sessionStorage. A back or forward is noticed by a popstate listener that stays on for the
 *       tab once /packs was opened; a mount at that URL moments later is coming back, and any
 *       other visit starts at the top. "Clear local data" forgets them. Best effort: no storage,
 *       a refusal or junk means the top.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";

export const LIST_VIEW_KEY_PREFIX = "packs:list-view:";

/** A mount this soon after a back or forward to its URL counts as coming back. */
export const TRAVERSAL_WINDOW_MS = 10_000;

/** How many results were showing, and how far down the page was scrolled. */
export type ListView = { shown: number; y: number };

const listViewSchema = z.object({
  shown: z.number().int().positive(),
  y: z.number().nonnegative(),
});

export type ViewStorage = Pick<Storage, "getItem" | "setItem">;

type ClearableStorage = Pick<Storage, "key" | "length" | "removeItem">;

/** window.sessionStorage, or null where there is no window or the browser refuses access. */
const browserStorage = (): Storage | null => {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
};

/**
 * @function saveListView
 * @param href {string} the page's path and query ("/packs?mods=DT")
 * @param view {ListView} results showing and the scroll position
 * @param storage {ViewStorage | null} where to keep it (default: sessionStorage)
 * @returns {void} keeps it for this URL; does nothing when storage refuses
 */
export const saveListView = (
  href: string,
  view: ListView,
  storage: ViewStorage | null = browserStorage(),
): void => {
  try {
    storage?.setItem(LIST_VIEW_KEY_PREFIX + href, JSON.stringify(view));
  } catch {
    // Full or refused: coming back starts at the top.
  }
};

/**
 * @function loadListView
 * @param href {string} the page's path and query
 * @param storage {ViewStorage | null} where it was kept (default: sessionStorage)
 * @returns {ListView | null} the view saved for this URL, or null when there is none, it can't be
 *          read, or storage refuses
 */
export const loadListView = (
  href: string,
  storage: ViewStorage | null = browserStorage(),
): ListView | null => {
  try {
    const raw = storage?.getItem(LIST_VIEW_KEY_PREFIX + href);
    if (!raw) return null;
    const parsed = listViewSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

/**
 * @function clearListViews
 * @param storage {ClearableStorage | null} where they're kept (default: sessionStorage)
 * @returns {void} forgets every saved view ("clear local data"), and nothing else in storage
 */
export const clearListViews = (storage: ClearableStorage | null = browserStorage()): void => {
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key?.startsWith(LIST_VIEW_KEY_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch {
    // Refused: the tab forgets them when it closes anyway.
  }
};

let traversal: { href: string; at: number } | null = null;
let watching = false;

/** The page's path and query, as views are keyed. */
const hereHref = (): string => window.location.pathname + window.location.search;

/**
 * @function watchTraversals
 * @returns {void} from the first call on (in the browser), notes every back and forward: where it
 *          went, and when. The listener stays for the tab, since the back to /packs happens while
 *          another page is showing.
 */
export const watchTraversals = (): void => {
  if (watching || typeof window === "undefined") return;
  watching = true;
  window.addEventListener("popstate", () => {
    traversal = { href: hereHref(), at: Date.now() };
  });
};

/**
 * @function cameBackTo
 * @param href {string} the page's path and query
 * @param now {number} the time (tests)
 * @returns {boolean} whether the last back or forward went to this URL within TRAVERSAL_WINDOW_MS
 */
export const cameBackTo = (href: string, now: number = Date.now()): boolean =>
  traversal !== null && traversal.href === href && now - traversal.at <= TRAVERSAL_WINDOW_MS;

/**
 * @function forgetTraversal
 * @returns {void} forgets the last back or forward (the page that came back used it)
 */
export const forgetTraversal = (): void => {
  traversal = null;
};
