/**
 * @file tests/unit/utils/stored-buckets.test.ts
 * @desc A stored bucket list comes out as zod expects it: built-ins as { code }, customs with their
 *       color and (when set) mods, and no list for a missing or empty one.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { storedBuckets } from "@/utils/stored-buckets";

describe("storedBuckets", () => {
  it("has no list for a missing or empty one", () => {
    expect(storedBuckets(undefined)).toBeUndefined();
    expect(storedBuckets(null)).toBeUndefined();
    expect(storedBuckets([])).toBeUndefined();
  });

  it("drops null colors and null mods", () => {
    expect(
      storedBuckets([
        { code: "NM", color: null },
        { code: "HD" },
        { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
        { code: "X", color: 1, mods: null },
      ]),
    ).toEqual([
      { code: "NM" },
      { code: "HD" },
      { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
      { code: "X", color: 1 },
    ]);
  });
});
