/**
 * @file src/utils/date.ts
 * @desc Date display helpers. ISO calendar dates are formatted in UTC so a "2026-09-22" never
 *       renders as Sep 21 on machines west of UTC.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

const LONG_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * @function formatIsoDate
 * @param iso {string} calendar date as YYYY-MM-DD
 * @returns {string} long US date, e.g. "September 22, 2026"
 * @throws {Error} when the input is not a real YYYY-MM-DD date (e.g. 2026-02-30)
 */
export const formatIsoDate = (iso: string): string => {
  if (!ISO_DATE.test(iso)) throw new Error(`expected YYYY-MM-DD, got "${iso}"`);
  const date = new Date(`${iso}T00:00:00Z`);
  // Date rolls 2026-02-30 over to March 2; comparing back catches impossible dates.
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    throw new Error(`not a real calendar date: "${iso}"`);
  }
  return LONG_DATE.format(date);
};

const SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

/**
 * @function formatShortDate
 * @param iso {string} an ISO timestamp (e.g. a saved pack's updatedAt)
 * @returns {string} its UTC calendar date, e.g. "Sep 22, 2026"
 * @throws {Error} when the input isn't a date
 */
export const formatShortDate = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error(`not a date: "${iso}"`);
  return SHORT_DATE.format(date);
};
