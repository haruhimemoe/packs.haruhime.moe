/**
 * @file tests/unit/schemas/star-ratings.test.ts
 * @desc The star-ratings query: valid pairs, canonical mod sets only, limits (pairs and raw
 *       length), duplicates, and the response shape the browser reads.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { MAX_STAR_PAIRS, MAX_STAR_QUERY_LENGTH } from "@/constants/star-ratings";
import {
  starPairSchema,
  starPairsQuerySchema,
  starRatingsResponseSchema,
} from "@/schemas/star-ratings";

describe("starPairSchema", () => {
  it("reads a beatmap id and a mod set", () => {
    expect(starPairSchema.parse("129891:HDHR")).toEqual({
      key: "129891:HDHR",
      beatmapId: 129891,
      set: ["HD", "HR"],
    });
  });

  it.each([
    "",
    "129891",
    "129891:",
    ":HD",
    "0:HD",
    "01:HD",
    "-5:HD",
    "abc:HD",
    "99999999999:HD",
    "129891:hd",
    "129891:NC",
    "129891:DTHD",
    "129891:EZHR",
    "129891:DTHT",
    "129891:HDH",
    "129891:EZHDDTFL",
    "129891:HD:HR",
  ])("rejects %j", (value) => {
    expect(starPairSchema.safeParse(value).success).toBe(false);
  });
});

describe("starPairsQuerySchema", () => {
  it("splits on commas and drops duplicates, keeping order", () => {
    expect(starPairsQuerySchema.parse("7:HR,7:HD,7:HR").map((p) => p.key)).toEqual([
      "7:HR",
      "7:HD",
    ]);
  });

  it(`takes up to ${MAX_STAR_PAIRS} pairs`, () => {
    const pairs = (n: number) => Array.from({ length: n }, (_, i) => `${i + 1}:HD`).join(",");
    expect(starPairsQuerySchema.safeParse(pairs(MAX_STAR_PAIRS)).success).toBe(true);
    expect(starPairsQuerySchema.safeParse(pairs(MAX_STAR_PAIRS + 1)).success).toBe(false);
  });

  it(`caps q at ${MAX_STAR_QUERY_LENGTH} characters, room for ${MAX_STAR_PAIRS} of the longest pairs`, () => {
    expect(MAX_STAR_QUERY_LENGTH).toBe(MAX_STAR_PAIRS * 24);
    const longest = Array.from({ length: MAX_STAR_PAIRS }, (_, i) => `${2_147_483_000 + i}:HDHRDT`);
    expect(starPairsQuerySchema.safeParse(longest.join(",")).success).toBe(true);
  });

  it("rejects an overlong q before splitting it", () => {
    const split = vi.spyOn(String.prototype, "split");
    const result = starPairsQuerySchema.safeParse("7:HD,".repeat(MAX_STAR_QUERY_LENGTH));
    const splits = split.mock.calls.length;
    split.mockRestore();
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.code).toBe("too_big");
    expect(splits).toBe(0);
  });

  it.each(["", ",", "7:HD,", "7:HD,,8:HD"])("rejects %j", (value) => {
    expect(starPairsQuerySchema.safeParse(value).success).toBe(false);
  });
});

describe("starRatingsResponseSchema", () => {
  it("reads ratings and pending pairs", () => {
    const body = { ratings: { "7:HD": 7.1 }, pending: ["8:HD"] };
    expect(starRatingsResponseSchema.parse(body)).toEqual(body);
  });

  it("rejects anything else", () => {
    expect(
      starRatingsResponseSchema.safeParse({ ratings: { "7:HD": "7" }, pending: [] }).success,
    ).toBe(false);
    expect(starRatingsResponseSchema.safeParse({ ratings: {} }).success).toBe(false);
  });
});
