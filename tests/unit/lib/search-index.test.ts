/**
 * @file tests/unit/lib/search-index.test.ts
 * @desc Fetching and validating /packs/index.json in the browser (entries with and without
 *       stats); index entries as cards, stats included.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { fetchSearchIndex, indexEntryToCard } from "@/lib/search-index";

const INDEX = {
  v: 1,
  packs: [
    { s: "aaaaaaaaaa", n: "Cup", o: "Chiyo", c: 3, d: "Quals", u: "2026-09-22T00:00:00.000Z" },
  ],
};

const WITH_STATS = {
  v: 1,
  packs: [
    {
      s: "bbbbbbbbbb",
      n: "Quals",
      o: "Chiyo",
      c: 12,
      d: "",
      u: "2026-09-24T00:00:00.000Z",
      t: "2026-09-20T00:00:00.000Z",
      r: [4.5, 6.2],
      a: 5.3,
      l: [95, 240],
      b: [150, 270],
      m: "NM,HD,HR,DT,FM,TB",
      g: "osu",
      k: true,
    },
    { s: "cccccccccc", n: "Old", o: "Chiyo", c: 3, d: "", u: "2026-09-20T00:00:00.000Z" },
  ],
};

describe("fetchSearchIndex", () => {
  it("fetches /packs/index.json and validates it", async () => {
    const doFetch = vi.fn(async () => Response.json(INDEX));
    expect(await fetchSearchIndex(doFetch)).toEqual(INDEX);
    expect(doFetch).toHaveBeenCalledWith("/packs/index.json");
  });

  it("accepts entries with and without stats", async () => {
    expect(await fetchSearchIndex(async () => Response.json(WITH_STATS))).toEqual(WITH_STATS);
  });

  it("throws on an error status or a bad shape", async () => {
    await expect(fetchSearchIndex(async () => new Response("", { status: 500 }))).rejects.toThrow(
      "500",
    );
    await expect(fetchSearchIndex(async () => Response.json({ v: 2 }))).rejects.toThrow();
  });
});

describe("indexEntryToCard", () => {
  it("keeps an entry's stats on the card", () => {
    const stats = {
      r: [5.12, 7.81] as [number, number],
      a: 6.3,
      l: [90, 258] as [number, number],
      b: [120, 333] as [number, number],
      m: "NM,DT",
      g: "osu",
      k: false,
    };
    const entry = { ...(INDEX.packs[0] as (typeof INDEX.packs)[number]), ...stats };
    expect(indexEntryToCard(entry).stats).toEqual(stats);
    expect(indexEntryToCard({ ...entry, r: undefined, a: undefined }).stats).toEqual({
      l: [90, 258],
      b: [120, 333],
      m: "NM,DT",
      g: "osu",
      k: false,
    });
  });

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

  it("carries an archive pack's source link, and nothing without both keys", () => {
    const entry = INDEX.packs[0] as (typeof INDEX.packs)[number];
    const url = "https://otdb.sheppsu.me/db/mappools/657/";
    expect(indexEntryToCard({ ...entry, x: 1, xk: "otdb", xu: url }).archiveSource).toEqual({
      kind: "otdb",
      url,
    });
    expect(indexEntryToCard({ ...entry, x: 1 })).not.toHaveProperty("archiveSource");
  });

  it("carries the creation date when the entry has one", () => {
    const entry = INDEX.packs[0] as (typeof INDEX.packs)[number];
    expect(indexEntryToCard({ ...entry, t: "2026-08-03T00:00:00.000Z" }).createdAt).toBe(
      "2026-08-03T00:00:00.000Z",
    );
  });
});
