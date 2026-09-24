/**
 * @file tests/unit/app/home-page.test.ts
 * @desc The homepage's recent-packs read: the 6 newest community packs, and never an error.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/public-packs", () => ({ listRecentPacks: vi.fn() }));

const { loadRecentPacks, metadata, revalidate } = await import("@/app/(public)/page");

const card = (i: number) => ({
  slug: `aaaaaaaaa${i}`,
  name: `P${i}`,
  ownerName: "o",
  ownerAvatarUrl: null,
  slotCount: 1,
  excerpt: "",
  updatedAt: "2026-09-22T00:00:00.000Z",
});

describe("homepage", () => {
  it("is ISR, regenerating at most once a day", () => {
    expect(revalidate).toBe(86400);
  });

  it("asks for the 6 newest community packs and keeps at most 6", async () => {
    const load = vi.fn(async () => Array.from({ length: 9 }, (_, i) => card(i)));
    expect((await loadRecentPacks(load)).map((p) => p.name)).toEqual([
      "P0",
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
    ]);
    expect(load).toHaveBeenCalledWith(6);
  });

  it("reads community packs by default, so archive packs never fill the strip", async () => {
    const { listRecentPacks } = await import("@/services/public-packs");
    vi.mocked(listRecentPacks).mockResolvedValueOnce([card(1)]);
    expect((await loadRecentPacks()).map((p) => p.name)).toEqual(["P1"]);
    expect(listRecentPacks).toHaveBeenCalledWith(6);
  });

  it("renders without the strip when the list can't load", async () => {
    expect(await loadRecentPacks(async () => Promise.reject(new Error("no database")))).toEqual([]);
  });

  it("has a title short enough for search results (with the site suffix, under 60)", () => {
    expect(metadata.title).toBe("osu! mappool pack builder");
    expect(`${metadata.title} · packs.haruhime.moe`.length).toBeLessThan(60);
  });
});
