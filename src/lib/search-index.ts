/**
 * @file src/lib/search-index.ts
 * @desc Browser side of public search: fetch and validate /packs/index.json (served from the CDN
 *       cache), and turn index entries into cards.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

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

/**
 * @function indexEntryToCard
 * @param entry {SearchIndexEntry} compact index entry
 * @returns {PublicPackCard} the card shape (no avatar: the index leaves it out to stay small)
 */
export const indexEntryToCard = (entry: SearchIndexEntry): PublicPackCard => ({
  slug: entry.s,
  name: entry.n,
  ownerName: entry.o,
  ownerAvatarUrl: null,
  slotCount: entry.c,
  excerpt: entry.d,
  updatedAt: entry.u,
});
