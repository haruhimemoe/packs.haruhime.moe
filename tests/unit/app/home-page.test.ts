/**
 * @file tests/unit/app/home-page.test.ts
 * @desc The homepage's recent-packs read: at most 6, and never an error.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/public-packs", () => ({ listPublicPacks: vi.fn() }));

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

  it("keeps the 6 newest public packs", async () => {
    const load = vi.fn(async () => ({
      packs: Array.from({ length: 9 }, (_, i) => card(i)),
      page: 1,
      pageCount: 1,
      total: 9,
    }));
    expect((await loadRecentPacks(load)).map((p) => p.name)).toEqual([
      "P0",
      "P1",
      "P2",
      "P3",
      "P4",
      "P5",
    ]);
  });

  it("renders without the strip when the list can't load", async () => {
    expect(await loadRecentPacks(async () => Promise.reject(new Error("no database")))).toEqual([]);
  });

  it("has a title short enough for search results (with the site suffix, under 60)", () => {
    expect(metadata.title).toBe("osu! mappool pack builder");
    expect(`${metadata.title} · packs.haruhime.moe`.length).toBeLessThan(60);
  });
});
