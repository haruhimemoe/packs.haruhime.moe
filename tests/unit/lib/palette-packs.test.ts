/**
 * @file tests/unit/lib/palette-packs.test.ts
 * @desc createPacksProvider: loads the index once and reuses it, filters by name or owner
 *       (case-insensitively), caps results, drops a stale search, and retries after a failed
 *       load instead of caching it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { createPacksProvider } from "@/lib/palette-packs";
import type { SearchIndex } from "@/schemas/public-pack";

const INDEX: SearchIndex = {
  v: 1,
  packs: [
    { s: "aaaaaaaaaa", n: "Winter Cup", o: "Chiyo", c: 3, d: "", u: "2026-09-22T00:00:00.000Z" },
    { s: "bbbbbbbbbb", n: "Spring Quals", o: "peppy", c: 5, d: "", u: "2026-09-24T00:00:00.000Z" },
  ],
};

describe("createPacksProvider", () => {
  it("fetches the index once, then reuses it across searches", async () => {
    const loadIndex = vi.fn(async () => INDEX);
    const provider = createPacksProvider(loadIndex);
    await provider.search("winter", new AbortController().signal);
    await provider.search("spring", new AbortController().signal);
    expect(loadIndex).toHaveBeenCalledOnce();
  });

  it("matches by pack name, case-insensitively", async () => {
    const provider = createPacksProvider(async () => INDEX);
    const rows = await provider.search("WINTER", new AbortController().signal);
    expect(rows).toEqual([
      {
        id: "packs.pack.aaaaaaaaaa",
        title: "Winter Cup",
        subtitle: "by Chiyo",
        group: "Packs",
        run: expect.any(Function),
      },
    ]);
  });

  it("matches by owner name", async () => {
    const provider = createPacksProvider(async () => INDEX);
    const rows = await provider.search("peppy", new AbortController().signal);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.title).toBe("Spring Quals");
  });

  it("navigates to the pack's page when run", async () => {
    const provider = createPacksProvider(async () => INDEX);
    const [row] = await provider.search("winter", new AbortController().signal);
    const navigate = vi.fn();
    await row?.run?.(
      { navigate, close: vi.fn(), push: vi.fn(), copy: vi.fn(), pathname: "", commands: [] },
      {},
    );
    expect(navigate).toHaveBeenCalledWith("/p/aaaaaaaaaa");
  });

  it("returns nothing once the signal is aborted", async () => {
    const provider = createPacksProvider(async () => INDEX);
    const controller = new AbortController();
    controller.abort();
    expect(await provider.search("winter", controller.signal)).toEqual([]);
  });

  it("caps results at 8", async () => {
    const many: SearchIndex = {
      v: 1,
      packs: Array.from({ length: 12 }, (_, i) => ({
        s: `pack${i.toString().padStart(6, "0")}`,
        n: `Cup ${i}`,
        o: "Chiyo",
        c: 1,
        d: "",
        u: "2026-09-22T00:00:00.000Z",
      })),
    };
    const provider = createPacksProvider(async () => many);
    expect(await provider.search("cup", new AbortController().signal)).toHaveLength(8);
  });

  it("doesn't cache a failed load; the next search tries again", async () => {
    const loadIndex = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(INDEX);
    const provider = createPacksProvider(loadIndex);
    await expect(provider.search("winter", new AbortController().signal)).rejects.toThrow(
      "offline",
    );
    const rows = await provider.search("winter", new AbortController().signal);
    expect(rows).toHaveLength(1);
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });
});
