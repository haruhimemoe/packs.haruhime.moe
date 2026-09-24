/**
 * @file tests/unit/utils/shuffle.test.ts
 * @desc Fisher-Yates shuffle with an injectable random source: a permutation of the input, the
 *       input left alone, and the same order for the same random sequence.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { shuffled } from "@/utils/shuffle";

/** mulberry32: a tiny seeded generator, so a shuffle is repeatable in a test. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const ITEMS = Array.from({ length: 25 }, (_, i) => i);

describe("shuffled", () => {
  it("returns every item once, in a new order, and leaves the input alone", () => {
    const input = [...ITEMS];
    const out = shuffled(input, seeded(1));
    expect(input).toEqual(ITEMS);
    expect([...out].sort((a, b) => a - b)).toEqual(ITEMS);
    expect(out).not.toEqual(ITEMS);
  });

  it("gives the same order for the same random sequence", () => {
    expect(shuffled(ITEMS, seeded(7))).toEqual(shuffled(ITEMS, seeded(7)));
    expect(shuffled(ITEMS, seeded(7))).not.toEqual(shuffled(ITEMS, seeded(8)));
  });

  it("swaps each position with one at or before it (random just under 1 keeps the order)", () => {
    expect(shuffled(ITEMS, () => 0.999_999)).toEqual(ITEMS);
    expect(shuffled([], Math.random)).toEqual([]);
  });
});
