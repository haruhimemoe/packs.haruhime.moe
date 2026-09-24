/**
 * @file tests/unit/services/map-usage.test.ts
 * @desc refreshMapUsage never fails the change that called it: a database error is logged and
 *       swallowed (the importer's next full rebuild repairs the maps).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  connectedDb: vi.fn(async () => {
    throw new Error("server selection timed out");
  }),
}));

const { rebuildMapUsage, refreshMapUsage } = await import("@/services/map-usage");

describe("refreshMapUsage", () => {
  it("logs a failed rebuild instead of throwing", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(refreshMapUsage([75])).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledWith("map usage: couldn't rebuild", expect.any(Error));
    error.mockRestore();
  });

  it("while rebuildMapUsage itself still throws", async () => {
    await expect(rebuildMapUsage([75])).rejects.toThrow("server selection timed out");
  });
});
