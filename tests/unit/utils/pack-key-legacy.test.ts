/**
 * @file tests/unit/utils/pack-key-legacy.test.ts
 * @desc Old keys never break (qol spec §5.1): every recorded pk1/pk2 key decodes to the same pool,
 *       and that pool still encodes to the exact same key. pk3 likewise, from pk3.json: cases copied
 *       from @haruhimemoe/pool's tests/fixtures/packs-keys.json, which was recorded from packs at
 *       aa9ae4a (key and decoded pool both). Never edit or regenerate a fixture; a failure here
 *       means an existing key changed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import {
  bucketsOf,
  canonicalBuckets,
  decodePackKey,
  encodePackKey,
  type Pool as PackRef,
  sortSlots,
} from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import legacy from "../../fixtures/pack-keys/legacy.json";
import pk3 from "../../fixtures/pack-keys/pk3.json";

/** What decoding gives back: slots in pool order, buckets only when not the default. */
const normalized = (pack: PackRef): PackRef => {
  const list = bucketsOf(pack);
  const buckets = canonicalBuckets(list);
  const slots = sortSlots(pack.slots, list);
  return buckets ? { name: pack.name, slots, buckets } : { name: pack.name, slots };
};

describe.each(legacy)("$label", ({ pack, key }) => {
  // JSON widens codes to string; the pack is valid, the test proves it.
  const ref = pack as unknown as PackRef;

  it("still encodes to the same key, byte for byte", () => {
    expect(encodePackKey(ref)).toBe(key);
  });

  it("still decodes to the same pool", () => {
    expect(decodePackKey(key)).toEqual(normalized(ref));
  });
});

it("covers both versions", () => {
  expect(new Set(legacy.map(({ key }) => key.slice(0, 4)))).toEqual(new Set(["pk1.", "pk2."]));
});

describe.each(pk3)("pk3: $label", ({ pack, key, decoded }) => {
  it("still encodes to the key aa9ae4a made, byte for byte", () => {
    expect(encodePackKey(pack as unknown as PackRef)).toBe(key);
  });

  it("still decodes to the pool aa9ae4a decoded", () => {
    expect(decodePackKey(key)).toEqual(decoded);
  });
});

it("pins only pk3 keys in pk3.json, a 64-map pool and an empty one among them", () => {
  expect(pk3.every(({ key }) => key.startsWith("pk3."))).toBe(true);
  expect(pk3.map(({ pack }) => pack.slots.length)).toEqual(expect.arrayContaining([0, 64]));
});
