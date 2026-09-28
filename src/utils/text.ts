/**
 * @file src/utils/text.ts
 * @desc Plain-text helpers: excerpts of pack descriptions, page meta descriptions, and regex
 *       escaping for admin name filters. Descriptions are normalized by @haruhimemoe/pool/service.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

const META_DESCRIPTION_LENGTH = 160;

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
 * @function metaDescription
 * @param description {string | undefined} the pack's description
 * @param slotCount {number} maps in the pack
 * @returns {string} the description cut to 160 characters, or "{n} maps. An osu! beatmap pack."
 */
export const metaDescription = (description: string | undefined, slotCount: number): string =>
  description
    ? excerpt(description, META_DESCRIPTION_LENGTH)
    : `${slotCount} ${slotCount === 1 ? "map" : "maps"}. An osu! beatmap pack.`;

/**
 * @function escapeRegExp
 * @param text {string} untrusted text
 * @returns {string} the text with every regex metacharacter escaped
 */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
