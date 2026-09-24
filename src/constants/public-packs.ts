/**
 * @file src/constants/public-packs.ts
 * @desc Page sizes and caps for /packs, its search index, and /admin.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

export const PUBLIC_PAGE_SIZE = 24;
export const ADMIN_PAGE_SIZE = 50;
/** ~150 bytes a pack: 5,000 packs is ~40 KB gzipped. Past that, move search to the server. */
export const SEARCH_INDEX_LIMIT = 5000;
export const SEARCH_RESULT_LIMIT = 50;
/** Last browsable /packs page: as deep as the search index goes. Past it, 404 without a query. */
export const MAX_PUBLIC_PAGE = Math.ceil(SEARCH_INDEX_LIMIT / PUBLIC_PAGE_SIZE);
