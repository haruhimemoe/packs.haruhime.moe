/**
 * @file src/utils/description-links.ts
 * @desc Splits a pack description into text and https:// links, so the pack page can make the
 *       links real. Only https: counts: http:, javascript: and every other scheme stay text, and
 *       so does a URL glued to a word before it. A link ends at whitespace, a quote or an angle
 *       bracket; punctuation that closes a sentence or a bracket after it stays text, except a ")"
 *       the URL opened itself (a Wikipedia link). Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

/** One piece of a description: text, or a link; `at` is where it starts (a stable React key). */
export type DescriptionPart =
  | { kind: "text"; text: string; at: number }
  | { kind: "link"; href: string; at: number };

/** An https:// run that doesn't follow a letter, digit or underscore. */
const HTTPS_RUN = /\bhttps:\/\/[^\s<>"]+/g;

/** Characters that usually close a sentence or a bracket rather than end a URL. */
const CLOSERS = ".,;:!?')]}";

const count = (text: string, char: string): number => text.split(char).length - 1;

/** Drops closing punctuation after the URL; keeps a ")" the URL opened itself. */
const trimUrl = (raw: string): string => {
  let url = raw;
  while (url.length > 0) {
    const last = url.slice(-1);
    if (!CLOSERS.includes(last)) break;
    if (last === ")" && count(url, "(") >= count(url, ")")) break;
    url = url.slice(0, -1);
  }
  return url;
};

const isHttpsUrl = (text: string): boolean => {
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname !== "";
  } catch {
    return false;
  }
};

/**
 * @function descriptionParts
 * @param text {string} a pack description
 * @returns {DescriptionPart[]} the description in order, each https:// URL a link part; joining
 *          every part's text or href gives the description back
 */
export const descriptionParts = (text: string): DescriptionPart[] => {
  const parts: DescriptionPart[] = [];
  let from = 0;
  for (const match of text.matchAll(HTTPS_RUN)) {
    const start = match.index ?? 0;
    const href = trimUrl(match[0]);
    if (!isHttpsUrl(href)) continue;
    if (start > from) parts.push({ kind: "text", text: text.slice(from, start), at: from });
    parts.push({ kind: "link", href, at: start });
    from = start + href.length;
  }
  if (from < text.length) parts.push({ kind: "text", text: text.slice(from), at: from });
  return parts;
};
