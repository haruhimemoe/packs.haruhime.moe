/**
 * @file src/lib/palette-packs.ts
 * @desc The command palette's packs provider: fetches the same /packs/index.json search index
 *       /packs' own browser search uses (src/lib/search-index.ts), once per tab, then filters it
 *       by pack name or owner. Matches become "Go to pack" commands that land on /p/<slug>. No
 *       query param to the server: the index is a public, unauthenticated, CDN-cached file, so a
 *       search costs the server nothing (confirmed against src/app/(public)/packs/index.json's
 *       route handler before writing this).
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import type { Command, Provider } from "@haruhimemoe/ui";
import { fetchSearchIndex } from "@/lib/search-index";
import type { SearchIndex, SearchIndexEntry } from "@/schemas/public-pack";

/** How many matches the palette shows at once. */
const MAX_RESULTS = 8;

/** Whether an entry's name or owner contains the (already lowercased) query. */
const matchesQuery = (entry: SearchIndexEntry, query: string): boolean =>
  entry.n.toLowerCase().includes(query) || entry.o.toLowerCase().includes(query);

/** One index entry as a palette row that navigates to the pack's page. */
const toCommand = (entry: SearchIndexEntry): Command => ({
  id: `packs.pack.${entry.s}`,
  title: entry.n,
  subtitle: `by ${entry.o}`,
  group: "Packs",
  run: (ctx) => ctx.navigate(`/p/${entry.s}`),
});

/**
 * @function createPacksProvider
 * @param loadIndex {() => Promise<SearchIndex>} fetches the search index (tests inject a stub)
 * @returns {Provider} searches public packs by name or owner, cached for the tab; a failed fetch
 *          isn't cached, so the next search tries again
 */
export const createPacksProvider = (
  loadIndex: () => Promise<SearchIndex> = fetchSearchIndex,
): Provider => {
  let cached: Promise<SearchIndex> | null = null;

  const load = (): Promise<SearchIndex> => {
    if (!cached) {
      cached = loadIndex().catch((error: unknown) => {
        cached = null;
        throw error;
      });
    }
    return cached;
  };

  return {
    id: "packs",
    group: "Packs",
    minLength: 2,
    search: async (query, signal) => {
      const index = await load();
      if (signal.aborted) return [];
      const q = query.toLowerCase();
      return index.packs
        .filter((entry) => matchesQuery(entry, q))
        .slice(0, MAX_RESULTS)
        .map(toCommand);
    },
  };
};
