/**
 * @file src/lib/torrent/bencode.ts
 * @desc Bencode encoder (BitTorrent's format): integers, byte strings, lists, and dicts whose keys
 *       are sorted by raw UTF-8 bytes. Encode-only; the site never reads torrents.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

export type Bencodable =
  | number
  | string
  | Uint8Array
  | readonly Bencodable[]
  | { readonly [key: string]: Bencodable | undefined };

const utf8 = new TextEncoder();

const compareBytes = (a: Uint8Array, b: Uint8Array): number => {
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return a.length - b.length;
};

const encodeInto = (value: Bencodable, out: Uint8Array[]): void => {
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error(`bencode: ${value} is not a safe integer`);
    out.push(utf8.encode(`i${value}e`));
  } else if (typeof value === "string") {
    encodeInto(utf8.encode(value), out);
  } else if (value instanceof Uint8Array) {
    out.push(utf8.encode(`${value.length}:`), value);
  } else if (Array.isArray(value)) {
    out.push(utf8.encode("l"));
    for (const item of value as readonly Bencodable[]) encodeInto(item, out);
    out.push(utf8.encode("e"));
  } else {
    // Undefined values (optional fields left out) are skipped, not encoded.
    const entries = Object.entries(value as { readonly [key: string]: Bencodable | undefined })
      .filter((pair): pair is [string, Bencodable] => pair[1] !== undefined)
      .map(([key, item]) => [utf8.encode(key), item] as const)
      .sort(([a], [b]) => compareBytes(a, b));
    out.push(utf8.encode("d"));
    for (const [key, item] of entries) {
      encodeInto(key, out);
      encodeInto(item, out);
    }
    out.push(utf8.encode("e"));
  }
};

/**
 * @function bencode
 * @param value {Bencodable} integers, strings (UTF-8), bytes, lists, dicts
 * @returns {Uint8Array<ArrayBuffer>} the encoded bytes
 * @throws {Error} when a number isn't a safe integer
 */
export const bencode = (value: Bencodable): Uint8Array<ArrayBuffer> => {
  const parts: Uint8Array[] = [];
  encodeInto(value, parts);
  const out = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
};
