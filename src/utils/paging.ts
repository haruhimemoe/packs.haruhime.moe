/**
 * @file src/utils/paging.ts
 * @desc Page numbers from untrusted params, and links for /packs pages and /admin filters.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { MAX_PUBLIC_PAGE } from "@/constants/public-packs";

/**
 * @function parsePageParam
 * @param raw {string} untrusted route segment or query value
 * @returns {number | null} 1 to 999999; null for "0", "01", "1.5", "abc", and anything longer
 */
export const parsePageParam = (raw: string): number | null =>
  /^[1-9]\d{0,5}$/.test(raw) ? Number(raw) : null;

/**
 * @function pageFromQuery
 * @param url {string} a request URL
 * @returns {number | null} its ?page= as parsePageParam reads it, 1 when absent, null when bad
 */
export const pageFromQuery = (url: string): number | null => {
  const raw = new URL(url).searchParams.get("page");
  return raw === null ? 1 : parsePageParam(raw);
};

/**
 * @function parsePublicPage
 * @param raw {string} untrusted /packs/page/[n] segment
 * @returns {number | null} a page from 1 to MAX_PUBLIC_PAGE, or null
 */
export const parsePublicPage = (raw: string): number | null => {
  const page = parsePageParam(raw);
  return page !== null && page <= MAX_PUBLIC_PAGE ? page : null;
};

/**
 * @function publicPageHref
 * @param page {number} 1-based page
 * @returns {string} "/packs" for page 1, "/packs/page/{n}" after
 */
export const publicPageHref = (page: number): string =>
  page <= 1 ? "/packs" : `/packs/page/${page}`;

/**
 * @function adminHref
 * @param options {{ page?: number; hiddenOnly?: boolean; query?: string }} filters in use
 * @returns {string} "/admin" with only the non-default filters as query params
 */
export const adminHref = ({
  page = 1,
  hiddenOnly = false,
  query = "",
}: {
  page?: number;
  hiddenOnly?: boolean;
  query?: string;
}): string => {
  const params = new URLSearchParams();
  if (hiddenOnly) params.set("show", "hidden");
  if (query) params.set("q", query);
  if (page > 1) params.set("page", String(page));
  const search = params.toString();
  return search ? `/admin?${search}` : "/admin";
};
