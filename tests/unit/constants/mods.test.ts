/**
 * @file tests/unit/constants/mods.test.ts
 * @desc Packs' own slot constants: the no-slot <select> value can't clash with a bucket code, and
 *       every palette color from @haruhimemoe/pool has a static badge class.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { BUCKET_CODE_PATTERN, isModBucket, PALETTE } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { NO_SLOT_VALUE } from "@/constants/mods";
import { PALETTE_STYLES } from "@/constants/palette";

describe("NO_SLOT_VALUE", () => {
  it("can never be a bucket code", () => {
    expect(BUCKET_CODE_PATTERN.test(NO_SLOT_VALUE)).toBe(false);
    expect(isModBucket(NO_SLOT_VALUE)).toBe(false);
  });
});

describe("PALETTE_STYLES", () => {
  it("has one static class per palette color, in palette order", () => {
    expect(PALETTE_STYLES).toHaveLength(PALETTE.length);
    expect(PALETTE_STYLES.every((className) => /^bg-[a-z]+-\d{3}$/.test(className))).toBe(true);
    expect(PALETTE_STYLES.map((className, id) => [PALETTE[id], className])).toEqual([
      ["Green", "bg-green-400"],
      ["Teal", "bg-teal-300"],
      ["Pink", "bg-pink-400"],
      ["Lime", "bg-lime-300"],
      ["Cyan", "bg-cyan-300"],
      ["Fuchsia", "bg-fuchsia-400"],
      ["Yellow", "bg-yellow-300"],
      ["Red", "bg-red-400"],
      ["Indigo", "bg-indigo-300"],
      ["Stone", "bg-stone-300"],
    ]);
  });
});
