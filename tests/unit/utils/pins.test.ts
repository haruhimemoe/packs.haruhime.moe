/**
 * @file tests/unit/utils/pins.test.ts
 * @desc Pin rules: only public packs that aren't hidden, at most MAX_PINNED_PACKS, new pins go
 *       last, a reorder names exactly the pinned packs, moving one up or down, and when a pin
 *       that raced past the limit backs out.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { MAX_PINNED_PACKS } from "@/constants/public-packs";
import {
  isOverPinLimit,
  isPinnable,
  isSamePinSet,
  movePin,
  nextPinOrder,
  PIN_HIDDEN,
  PIN_LIMIT,
  PIN_PUBLIC_ONLY,
  pinRefusal,
} from "@/utils/pins";

describe("isPinnable", () => {
  it("allows public packs that aren't hidden", () => {
    expect(isPinnable({ visibility: "public", hidden: false })).toBe(true);
  });

  it.each([
    ["unlisted", false],
    ["private", false],
    ["public", true],
    ["unlisted", true],
  ] as const)("refuses %s packs (hidden: %s)", (visibility, hidden) => {
    expect(isPinnable({ visibility, hidden })).toBe(false);
  });
});

describe("pinRefusal", () => {
  it("allows a public pack while there's room", () => {
    expect(pinRefusal({ visibility: "public", hidden: false }, 0)).toBeNull();
    expect(pinRefusal({ visibility: "public", hidden: false }, MAX_PINNED_PACKS - 1)).toBeNull();
  });

  it("refuses packs that aren't public", () => {
    expect(pinRefusal({ visibility: "unlisted", hidden: false }, 0)).toBe(PIN_PUBLIC_ONLY);
    expect(pinRefusal({ visibility: "private", hidden: false }, 0)).toBe(PIN_PUBLIC_ONLY);
  });

  it("refuses hidden packs", () => {
    expect(pinRefusal({ visibility: "public", hidden: true }, 0)).toBe(PIN_HIDDEN);
  });

  it("refuses one more once the limit is reached, with a message that says what to do", () => {
    expect(pinRefusal({ visibility: "public", hidden: false }, MAX_PINNED_PACKS)).toBe(PIN_LIMIT);
    expect(PIN_LIMIT).toBe("Only 6 packs can be pinned at once. Unpin one to pin another.");
  });

  it("names what's wrong with the pack before the limit", () => {
    expect(pinRefusal({ visibility: "unlisted", hidden: true }, MAX_PINNED_PACKS)).toBe(
      PIN_PUBLIC_ONLY,
    );
    expect(pinRefusal({ visibility: "public", hidden: true }, MAX_PINNED_PACKS)).toBe(PIN_HIDDEN);
  });
});

describe("nextPinOrder", () => {
  it("starts at 0", () => {
    expect(nextPinOrder([])).toBe(0);
  });

  it("goes one past the highest, gaps and all", () => {
    expect(nextPinOrder([0, 1, 2])).toBe(3);
    expect(nextPinOrder([4, 0])).toBe(5);
  });

  it("ignores missing orders", () => {
    expect(nextPinOrder([null, undefined])).toBe(0);
    expect(nextPinOrder([undefined, 2])).toBe(3);
  });
});

describe("isSamePinSet", () => {
  it("accepts the pinned packs in any order", () => {
    expect(isSamePinSet(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
    expect(isSamePinSet([], [])).toBe(true);
  });

  it.each([
    [["a", "b"], ["a"]],
    [["a"], ["a", "b"]],
    [
      ["a", "b"],
      ["a", "c"],
    ],
    [
      ["a", "b"],
      ["a", "a"],
    ],
  ])("refuses %j reordered as %j", (current, requested) => {
    expect(isSamePinSet(current, requested)).toBe(false);
  });
});

describe("movePin", () => {
  it("moves a pack up or down one place", () => {
    expect(movePin(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(movePin(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("leaves the order alone at either end, or for a pack that isn't pinned", () => {
    expect(movePin(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(movePin(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(movePin(["a", "b"], "z", 1)).toEqual(["a", "b"]);
  });

  it("never changes the list it was given", () => {
    const slugs = ["a", "b"] as const;
    movePin(slugs, "b", -1);
    expect(slugs).toEqual(["a", "b"]);
  });
});

describe("isOverPinLimit", () => {
  it("keeps a pin that fits", () => {
    expect(isOverPinLimit(1)).toBe(false);
    expect(isOverPinLimit(MAX_PINNED_PACKS)).toBe(false);
  });

  it("backs out a pin that finds the limit passed", () => {
    expect(isOverPinLimit(MAX_PINNED_PACKS + 1)).toBe(true);
  });
});
