/**
 * @file tests/unit/lib/search-index.test.ts
 * @desc Fetching and validating /packs/index.json in the browser; index entries as cards.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { fetchSearchIndex, indexEntryToCard } from "@/lib/search-index";

const INDEX = {
  v: 1,
  packs: [
    { s: "aaaaaaaaaa", n: "Cup", o: "Chiyo", c: 3, d: "Quals", u: "2026-09-22T00:00:00.000Z" },
  ],
};

describe("fetchSearchIndex", () => {
  it("fetches /packs/index.json and validates it", async () => {
    const doFetch = vi.fn(async () => Response.json(INDEX));
    expect(await fetchSearchIndex(doFetch)).toEqual(INDEX);
    expect(doFetch).toHaveBeenCalledWith("/packs/index.json");
  });

  it("throws on an error status or a bad shape", async () => {
    await expect(fetchSearchIndex(async () => new Response("", { status: 500 }))).rejects.toThrow(
      "500",
    );
    await expect(fetchSearchIndex(async () => Response.json({ v: 2 }))).rejects.toThrow();
  });
});

describe("indexEntryToCard", () => {
  it("expands the short keys", () => {
    expect(indexEntryToCard(INDEX.packs[0] as (typeof INDEX.packs)[number])).toEqual({
      slug: "aaaaaaaaaa",
      name: "Cup",
      ownerName: "Chiyo",
      ownerAvatarUrl: null,
      slotCount: 3,
      excerpt: "Quals",
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
  });
});
