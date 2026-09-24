/**
 * @file src/lib/search-index.ts
 * @desc Browser side of public search: fetch and validate /packs/index.json (served from the CDN
 *       cache), and turn index entries into cards (stats included when the entry has them).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import type { IndexStats } from "@/schemas/pack-stats";
import {
  type PublicPackCard,
  type SearchIndex,
  type SearchIndexEntry,
  searchIndexSchema,
} from "@/schemas/public-pack";

export const SEARCH_INDEX_PATH = "/packs/index.json";

/**
 * @function fetchSearchIndex
 * @param doFetch {(input: string) => Promise<Response>} fetch (tests)
 * @returns {Promise<SearchIndex>} the validated index
 * @throws {Error} on a failed request or an unexpected shape
 */
export const fetchSearchIndex = async (
  doFetch: (input: string) => Promise<Response> = (input) => globalThis.fetch(input),
): Promise<SearchIndex> => {
  const response = await doFetch(SEARCH_INDEX_PATH);
  if (!response.ok) throw new Error(`Search index request failed (${response.status}).`);
  return searchIndexSchema.parse(await response.json());
};

/** An entry's stats, when it has them (k is always there with stats). */
const statsOf = ({ r, a, l, b, m, g, k }: SearchIndexEntry): IndexStats | undefined =>
  k === undefined
    ? undefined
    : {
        ...(r ? { r } : {}),
        ...(a === undefined ? {} : { a }),
        ...(l ? { l } : {}),
        ...(b ? { b } : {}),
        m: m ?? "",
        g: g ?? "",
        k,
      };

/**
 * @function indexEntryToCard
 * @param entry {SearchIndexEntry} compact index entry
 * @returns {PublicPackCard} the card shape (no avatar: the index leaves it out to stay small),
 *          with the entry's stats when it has them
 */
export const indexEntryToCard = (entry: SearchIndexEntry): PublicPackCard => {
  const stats = statsOf(entry);
  return {
    slug: entry.s,
    name: entry.n,
    ownerName: entry.o,
    ownerAvatarUrl: null,
    slotCount: entry.c,
    excerpt: entry.d,
    updatedAt: entry.u,
    ...(stats ? { stats } : {}),
  };
};
