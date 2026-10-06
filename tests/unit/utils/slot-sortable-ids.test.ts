/**
 * @file tests/unit/utils/slot-sortable-ids.test.ts
 * @desc bucketListId and slotItemId: the pool table's sortable container and item ids.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it } from "vitest";
import { bucketListId, slotItemId } from "@/utils/slot-sortable-ids";

describe("bucketListId", () => {
  it("prefixes a bucket's code", () => {
    expect(bucketListId("NM")).toBe("b:NM");
  });

  it("is empty after the prefix for no slot", () => {
    expect(bucketListId(null)).toBe("b:");
  });
});

describe("slotItemId", () => {
  it("prefixes a map's beatmap id", () => {
    expect(slotItemId(42)).toBe("m:42");
  });
});
