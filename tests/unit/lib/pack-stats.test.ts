/**
 * @file tests/unit/lib/pack-stats.test.ts
 * @desc afterResponse outside a request (a script, a test without Next's request store) warns
 *       and runs nothing, so no stats work ever happens unattended.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { afterResponse } from "@/lib/pack-stats";

describe("afterResponse", () => {
  it("skips the work with a warning when there's no request to run after", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const task = vi.fn(async () => {});
    try {
      afterResponse(task);
      expect(task).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledWith(
        "[stats] not in a request, so nothing was scheduled:",
        expect.stringContaining("outside a request scope"),
      );
    } finally {
      warn.mockRestore();
    }
  });
});
