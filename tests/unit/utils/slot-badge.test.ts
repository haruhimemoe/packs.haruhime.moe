/**
 * @file tests/unit/utils/slot-badge.test.ts
 * @desc slotBadgeValue: a slot's label, bucket title, the mod that picks a built-in color, and
 *       a custom bucket's palette color by name.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { DEFAULT_BUCKETS } from "@haruhimemoe/pool";
import { describe, expect, it } from "vitest";
import { paletteColor } from "@/constants/palette";
import { slotBadgeValue } from "@/utils/slot-badge";

describe("slotBadgeValue", () => {
  it("labels a built-in slot with its bucket's name and no color override", () => {
    const nm = DEFAULT_BUCKETS[0] ?? null;
    const value = slotBadgeValue(nm, 1);
    expect(value.label).toBe(`${nm?.code}1`);
    expect(value.mod).toBe(nm?.code);
    expect(value.color).toBeUndefined();
    expect(typeof value.title).toBe("string");
  });

  it("colors a custom bucket by its palette name", () => {
    expect(slotBadgeValue({ code: "EZ", color: 2 }, 1).color).toBe(paletteColor(2));
    expect(slotBadgeValue({ code: "EZ", color: 2 }, 1).label).toBe("EZ1");
  });

  it("shows a dash and stays neutral with no slot and no index", () => {
    expect(slotBadgeValue(null)).toMatchObject({ label: "–", mod: "" });
  });
});
