/**
 * @file tests/unit/utils/color.test.ts
 * @desc HSL to hex, as CSS computes it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { hslToHex } from "@/utils/color";

describe("hslToHex", () => {
  it.each([
    [0, 0, 0, "#000000"],
    [0, 0, 100, "#ffffff"],
    [0, 100, 50, "#ff0000"],
    [120, 100, 25, "#008000"],
    [333, 100, 70, "#ff66ab"],
  ] as const)("hsl(%d %d%% %d%%) → %s", (h, s, l, hex) => {
    expect(hslToHex(h, s, l)).toBe(hex);
  });
});
