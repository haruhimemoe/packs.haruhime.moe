/**
 * @file src/utils/json-ld.ts
 * @desc Serialize schema.org JSON-LD for a <script> tag. "<" is escaped so no string inside
 *       (a pack name, say) can close the tag.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

/**
 * @function jsonLdString
 * @param data {Record<string, unknown>} a schema.org object without @context
 * @returns {string} JSON with @context added and every "<" written as <
 */
export const jsonLdString = (data: Record<string, unknown>): string =>
  JSON.stringify({ "@context": "https://schema.org", ...data }).replace(/</g, "\\u003c");
