/**
 * @file src/utils/pins.ts
 * @desc Pin rules for the "Pinned" row on /packs: only public packs that aren't hidden, at most
 *       MAX_PINNED_PACKS, a new pin goes last, a reorder names exactly the pinned packs, and a pin
 *       that finds the limit passed once it's written backs out. Pure; src/services/pins.ts
 *       applies them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { MAX_PINNED_PACKS } from "@/constants/public-packs";

export const PIN_PUBLIC_ONLY = "Only public packs can be pinned.";
export const PIN_HIDDEN = "A hidden pack can't be pinned. Unhide it first.";
export const PIN_LIMIT = `Only ${MAX_PINNED_PACKS} packs can be pinned at once. Unpin one to pin another.`;
export const PINS_CHANGED = "The pinned packs changed. Reload the page and try again.";

/** What the rules look at: the pack's visibility and whether a moderator hid it. */
export type PinCandidate = { visibility: string; hidden: boolean };

/**
 * @function isPinnable
 * @param pack {PinCandidate} visibility and hidden flag
 * @returns {boolean} true for a public pack that isn't hidden
 */
export const isPinnable = ({ visibility, hidden }: PinCandidate): boolean =>
  visibility === "public" && !hidden;

/**
 * @function pinRefusal
 * @param pack {PinCandidate} the pack an admin wants to pin
 * @param pinnedCount {number} packs pinned right now
 * @returns {string | null} why it can't be pinned (the pack first, then the limit), or null
 */
export const pinRefusal = (pack: PinCandidate, pinnedCount: number): string | null => {
  if (pack.visibility !== "public") return PIN_PUBLIC_ONLY;
  if (pack.hidden) return PIN_HIDDEN;
  if (pinnedCount >= MAX_PINNED_PACKS) return PIN_LIMIT;
  return null;
};

/**
 * @function nextPinOrder
 * @param orders {readonly (number | null | undefined)[]} the pinned packs' pinOrder values
 * @returns {number} one past the highest (a new pin goes last), 0 when there are none
 */
export const nextPinOrder = (orders: readonly (number | null | undefined)[]): number =>
  orders.reduce<number>(
    (next, order) => (typeof order === "number" ? Math.max(next, order + 1) : next),
    0,
  );

/**
 * @function isSamePinSet
 * @param current {readonly string[]} slugs pinned now
 * @param requested {readonly string[]} slugs in the order an admin asked for
 * @returns {boolean} true when requested lists every pinned slug exactly once and nothing else
 */
export const isSamePinSet = (current: readonly string[], requested: readonly string[]): boolean =>
  requested.length === current.length &&
  new Set(requested).size === requested.length &&
  requested.every((slug) => current.includes(slug));

/**
 * @function movePin
 * @param slugs {readonly string[]} pinned slugs in order
 * @param slug {string} the one to move
 * @param by {-1 | 1} up (earlier) or down (later) one place
 * @returns {string[]} a new list; the same order when it's already at that end or isn't listed
 */
export const movePin = (slugs: readonly string[], slug: string, by: -1 | 1): string[] => {
  const from = slugs.indexOf(slug);
  const to = from + by;
  const next = [...slugs];
  if (from === -1 || to < 0 || to >= slugs.length) return next;
  next[from] = next[to] as string;
  next[to] = slug;
  return next;
};

/**
 * @function isOverPinLimit
 * @param pinnedCount {number} packs pinned right after a pin was written
 * @returns {boolean} true when that's more than MAX_PINNED_PACKS, so the pin has to back out.
 *          Two pins racing for the last place can both back out; they can never both stay.
 */
export const isOverPinLimit = (pinnedCount: number): boolean => pinnedCount > MAX_PINNED_PACKS;
