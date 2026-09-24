/**
 * @file src/utils/magnet.ts
 * @desc Magnet links for pack torrents: build one, read its BitTorrent v1 infohash back out, and
 *       rebuild an untrusted link from only what our own links carry (infohash, name, size, our
 *       trackers). Anything else, including another scheme, counts as not a magnet link.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { MAX_MAGNET_LENGTH } from "@/constants/pack";
import { TRACKERS } from "@/constants/trackers";

export const MAGNET_PREFIX = "magnet:?";

export type MagnetInput = {
  infoHash: string;
  name: string;
  totalBytes: number;
  trackers: readonly string[];
};

/**
 * @function magnetUri
 * @param input {MagnetInput} hex infohash, display name, total size, trackers
 * @returns {string} "magnet:?xt=urn:btih:…&dn=…&xl=…&tr=…"
 */
export const magnetUri = ({ infoHash, name, totalBytes, trackers }: MagnetInput): string =>
  `${MAGNET_PREFIX}xt=urn:btih:${infoHash}&dn=${encodeURIComponent(name)}&xl=${totalBytes}${trackers
    .map((tracker) => `&tr=${encodeURIComponent(tracker)}`)
    .join("")}`;

const BTIH = /^urn:btih:([0-9a-f]{40})$/i;

/** Longest display name a canonical link keeps (code points). Ours are at most 48. */
export const MAX_DISPLAY_NAME = 128;

/** Control characters, and the bidi controls that can make a name read as something else. */
const UNSAFE_NAME_CHARS = /[\p{Cc}\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu;
const SIZE = /^[1-9][0-9]*$/;

const normalizeTracker = (tracker: string): string =>
  tracker.trim().toLowerCase().replace(/\/+$/, "");

type ParsedMagnet = {
  infoHash: string;
  name: string | null;
  size: number | null;
  trackers: string[];
};

const cleanName = (raw: string): string | null => {
  const name = Array.from(raw.replace(UNSAFE_NAME_CHARS, ""))
    .slice(0, MAX_DISPLAY_NAME)
    .join("")
    .trim();
  return name === "" ? null : name;
};

const cleanSize = (raw: string): number | null => {
  const size = Number(raw);
  return SIZE.test(raw) && Number.isSafeInteger(size) ? size : null;
};

const parseMagnet = (url: string, allowed: readonly string[]): ParsedMagnet | null => {
  if (!url.startsWith(MAGNET_PREFIX)) return null;
  const params = new URLSearchParams(url.slice(MAGNET_PREFIX.length));
  const topics = params.getAll("xt");
  // Some clients read xt.1, xt.2, … as more topics: one torrent per link, so refuse them.
  if (topics.length !== 1 || [...params.keys()].some((key) => key.startsWith("xt."))) return null;
  const infoHash = BTIH.exec(topics[0] ?? "")?.[1]?.toLowerCase();
  if (!infoHash) return null;
  const names = params.getAll("dn");
  const sizes = params.getAll("xl");
  if (names.length > 1 || sizes.length > 1) return null;
  const wanted = new Set(params.getAll("tr").map(normalizeTracker));
  return {
    infoHash,
    name: names[0] === undefined ? null : cleanName(names[0]),
    size: sizes[0] === undefined ? null : cleanSize(sizes[0]),
    // Ours only, each once, in our order: a link can't point clients at anyone else's tracker.
    trackers: allowed.filter((tracker) => wanted.has(normalizeTracker(tracker))),
  };
};

/**
 * @function infohashOf
 * @param url {string} untrusted text
 * @returns {string | null} the lower-case hex v1 infohash, or null unless url is a magnet link
 *          with exactly one xt=urn:btih:<40 hex> (and at most one dn and one xl)
 */
export const infohashOf = (url: string): string | null => parseMagnet(url, [])?.infoHash ?? null;

/**
 * @function canonicalMagnet
 * @param url {string} untrusted text
 * @param trackers {readonly string[]} the trackers a link may keep (ours)
 * @returns {string | null} "magnet:?xt=urn:btih:<hex>[&dn=…][&xl=…][&tr=…]", rebuilt from only the
 *          infohash, the name (control characters removed, capped), a positive whole size, and
 *          the trackers on the list. Web seeds, sources, peers and every other parameter are
 *          dropped. null when url isn't a magnet link infohashOf accepts. A link our torrent
 *          builder made comes back unchanged. Re-encoding a raw name can grow it well past the
 *          length of the input (a control-character-free but heavily encoded name can be several
 *          times longer once each character becomes %XX), so the rebuilt link is capped at
 *          MAX_MAGNET_LENGTH: the name is dropped first, and if it's still too long this returns
 *          null instead of handing back a link that would fail magnetSchema wherever it's read.
 */
export const canonicalMagnet = (
  url: string,
  trackers: readonly string[] = TRACKERS,
): string | null => {
  const parsed = parseMagnet(url, trackers);
  if (!parsed) return null;
  const { infoHash, size } = parsed;
  const tail = `${size === null ? "" : `&xl=${size}`}${parsed.trackers
    .map((tracker) => `&tr=${encodeURIComponent(tracker)}`)
    .join("")}`;
  const build = (name: string | null) =>
    `${MAGNET_PREFIX}xt=urn:btih:${infoHash}${name === null ? "" : `&dn=${encodeURIComponent(name)}`}${tail}`;
  const withName = build(parsed.name);
  if (withName.length <= MAX_MAGNET_LENGTH) return withName;
  const withoutName = build(null);
  return withoutName.length <= MAX_MAGNET_LENGTH ? withoutName : null;
};

/**
 * @function canonicalLinks
 * @param list {readonly T[]} entries with an untrusted `url`, in display order
 * @param trackers {readonly string[]} the trackers a link may keep (ours)
 * @returns {T[]} the same order, each url rebuilt by canonicalMagnet, entries whose url isn't a
 *          magnet link dropped, and only the first entry per infohash kept
 */
export const canonicalLinks = <T extends { url: string }>(
  list: readonly T[],
  trackers: readonly string[] = TRACKERS,
): T[] => {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const entry of list) {
    const url = canonicalMagnet(entry.url, trackers);
    const hash = url === null ? null : infohashOf(url);
    if (url === null || hash === null || seen.has(hash)) continue;
    seen.add(hash);
    out.push({ ...entry, url });
  }
  return out;
};
