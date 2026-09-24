/**
 * @file src/utils/account-export.ts
 * @desc The "Download my data" file name. osu! usernames use letters, digits, spaces, - _ [ ];
 *       everything outside A-Z a-z 0-9 - _ [ ] becomes "_" so the name is plain ASCII, safe inside
 *       a quoted Content-Disposition filename on every OS.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

const UNSAFE = /[^A-Za-z0-9_[\]-]+/g;

/**
 * @function accountExportFileName
 * @param username {string} the account's osu! username
 * @param at {Date} when the export was made
 * @returns {string} "packs-data-{username}-{yyyy-mm-dd}.json", UTC date, header-safe
 */
export const accountExportFileName = (username: string, at: Date): string => {
  const safe = username.replace(UNSAFE, "_") || "_";
  return `packs-data-${safe}-${at.toISOString().slice(0, 10)}.json`;
};
