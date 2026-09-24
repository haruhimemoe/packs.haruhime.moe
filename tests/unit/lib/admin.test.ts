/**
 * @file tests/unit/lib/admin.test.ts
 * @desc ADMIN_OSU_IDS parsing into a set of osu! ids.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { adminOsuIds } from "@/lib/admin";

describe("adminOsuIds", () => {
  it("is empty when unset", () => {
    expect(adminOsuIds(undefined).size).toBe(0);
  });

  it("reads comma-separated ids with spaces", () => {
    expect([...adminOsuIds("12231334, 2 ,3")]).toEqual([12231334, 2, 3]);
  });
});
