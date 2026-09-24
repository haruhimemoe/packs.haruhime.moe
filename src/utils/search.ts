/**
 * @file src/utils/search.ts
 * @desc Search over the public pack index in the browser: every term must appear in the name,
 *       host, or description, ignoring case and accents.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { SEARCH_RESULT_LIMIT } from "@/constants/public-packs";
import type { SearchIndexEntry } from "@/schemas/public-pack";

/**
 * @function foldForSearch
 * @param text {string} any text
 * @returns {string} lower case with accents removed ("PokÉmon" → "pokemon")
 */
export const foldForSearch = (text: string): string =>
  text.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();

export type PreparedEntry = { entry: SearchIndexEntry; haystack: string };

/**
 * @function prepareSearchIndex
 * @param entries {readonly SearchIndexEntry[]} the index, newest first
 * @returns {PreparedEntry[]} each entry with its folded name, host, and description, computed once
 */
export const prepareSearchIndex = (entries: readonly SearchIndexEntry[]): PreparedEntry[] =>
  entries.map((entry) => ({
    entry,
    haystack: foldForSearch(`${entry.n}\n${entry.o}\n${entry.d}`),
  }));

/**
 * @function searchPrepared
 * @param prepared {readonly PreparedEntry[]} from prepareSearchIndex
 * @param query {string} what was typed
 * @param limit {number} most results to return
 * @returns {SearchIndexEntry[]} entries whose text holds every term, in index order; none for a blank
 *          query
 */
export const searchPrepared = (
  prepared: readonly PreparedEntry[],
  query: string,
  limit: number = SEARCH_RESULT_LIMIT,
): SearchIndexEntry[] => {
  const terms = foldForSearch(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const matches: SearchIndexEntry[] = [];
  for (const { entry, haystack } of prepared) {
    if (terms.every((term) => haystack.includes(term))) {
      matches.push(entry);
      if (matches.length >= limit) break;
    }
  }
  return matches;
};

/**
 * @function searchPacks
 * @param entries {readonly SearchIndexEntry[]} the index, newest first
 * @param query {string} what was typed
 * @param limit {number} most results to return
 * @returns {SearchIndexEntry[]} matching entries in index order; none for a blank query
 */
export const searchPacks = (
  entries: readonly SearchIndexEntry[],
  query: string,
  limit: number = SEARCH_RESULT_LIMIT,
): SearchIndexEntry[] => searchPrepared(prepareSearchIndex(entries), query, limit);
