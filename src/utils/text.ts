/**
 * @file src/utils/text.ts
 * @desc Plain-text helpers: counts with their noun ("1 map", "3 maps"), excerpts of pack descriptions, and regex
 *       escaping for admin name filters. Descriptions are normalized by @haruhimemoe/pool/service.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

/**
 * @function countOf
 * @param count {number} how many
 * @param singular {string} the noun for one ("map")
 * @param plural {string} the noun for any other count (default: singular + "s")
 * @returns {string} "1 map", "0 maps", "3 collections"
 */
export const countOf = (count: number, singular: string, plural = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * @function excerpt
 * @param text {string} any text
 * @param max {number} characters (code points) to keep
 * @returns {string} whitespace collapsed to single spaces; cut at `max` with "…" when longer
 */
export const excerpt = (text: string, max: number): string => {
  const flat = text.replace(/\s+/g, " ").trim();
  const chars = Array.from(flat);
  if (chars.length <= max) return flat;
  return `${chars.slice(0, max).join("").trimEnd()}…`;
};

/**
 * @function escapeRegExp
 * @param text {string} untrusted text
 * @returns {string} the text with every regex metacharacter escaped
 */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
