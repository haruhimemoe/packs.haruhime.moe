/**
 * @file tests/unit/utils/star-rating.test.ts
 * @desc osu! star-rating colour spectrum (same stops as osu! lazer's difficulty colours).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { starRatingColor, starRatingTextColor } from "@/utils/star-rating";

describe("starRatingColor", () => {
  it.each([
    [0, "#aaaaaa"],
    [0.05, "#aaaaaa"],
    [0.1, "#4290fb"],
    [2, "#4fffd5"],
    [4.9, "#ff4e6f"],
    [9, "#000000"],
    [12.5, "#000000"],
  ])("%d stars → %s", (stars, hex) => {
    expect(starRatingColor(stars)).toBe(hex);
  });

  it("interpolates between stops", () => {
    // halfway between 2.0 #4fffd5 and 2.5 #7cff4f
    expect(starRatingColor(2.25)).toBe("#66ff92");
  });
});

describe("starRatingTextColor", () => {
  it("is dark on light pills and yellow on dark ones", () => {
    expect(starRatingTextColor(3)).toBe("#000000");
    expect(starRatingTextColor(7.8)).toBe("#ffd966");
  });
});
