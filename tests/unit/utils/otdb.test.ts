/**
 * @file tests/unit/utils/otdb.test.ts
 * @desc otdb's export (a committed sample of 22 real pools) to source pools: links, labels, osu!
 *       beatmap ids (not otdb's own), each map's mods, the map details that seed stats (a plain
 *       star rating only from an entry without rating mods), bad entries skipped, and no
 *       submitter data kept. Through normalizePools: EZ pools keep their EZ, and pools whose
 *       slots mix mods are skipped.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { normalizePools } from "@/utils/archive-pools";
import { otdbPoolUrl, otdbSource, readOtdbExport } from "@/utils/otdb";

const SAMPLE: unknown = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests", "fixtures", "otdb", "sample.json"), "utf8"),
);

const entry = (id: number, connections: unknown[]) => ({
  id,
  name: `Cup ${id} Finals`,
  description: "",
  submitted_by: { id: 1, username: "someone", avatar: "https://a.ppy.sh/1" },
  favorite_count: 3,
  beatmap_connections: connections,
});

const connection = (slot: string, osuId: number, starRating: number, mods: string[]) => ({
  slot,
  beatmap: {
    id: 9000 + osuId,
    star_rating: starRating,
    beatmapset_metadata: { id: 1, artist: "a", title: "t", creator: "c" },
    beatmap_metadata: { id: osuId, difficulty: "d", length: 100, bpm: 150 },
    mods: mods.map((acronym, i) => ({ id: i, acronym, settings: {} })),
  },
});

describe("otdb links", () => {
  it("builds a pool's link and source", () => {
    // otdb's pool page (database/urls.py: "db/" + "mappools/<int:id>/"); /mappool/58 is a 404.
    expect(otdbPoolUrl(58)).toBe("https://otdb.sheppsu.me/db/mappools/58/");
    expect(otdbPoolUrl("657")).toBe("https://otdb.sheppsu.me/db/mappools/657/");
    expect(otdbSource(58)).toEqual({
      kind: "otdb",
      id: "58",
      url: "https://otdb.sheppsu.me/db/mappools/58/",
    });
  });
});

describe("readOtdbExport", () => {
  it("reads every sample pool with its link, labels and osu! beatmap ids", () => {
    const { pools, skipped } = readOtdbExport(SAMPLE);
    expect(skipped).toEqual([]);
    expect(pools).toHaveLength(22);
    const [first] = pools;
    expect(first?.source).toEqual(otdbSource(58));
    expect(first?.name).toBe("Cindelluna's Winter Tour 2019 Finals (20k-10k)");
    expect(first?.slots.slice(0, 2)).toEqual([
      { label: "NM1", beatmapId: 989603, mods: [] },
      // otdb shares a map's entry between pools, so an NM slot can list another pool's mods.
      { label: "NM2", beatmapId: 1389960, mods: ["HD"] },
    ]);
    const semis = pools.find((pool) => pool.source.id === "641");
    expect(semis?.slots.find((slot) => slot.label === "HDDT1")?.mods).toEqual(["EZ", "HD", "DT"]);
  });

  it("keeps no submitter data or favorite counts", () => {
    const read = readOtdbExport([entry(1, [connection("NM1", 5, 5, [])])]);
    expect(JSON.stringify(read)).not.toMatch(/someone|submitted|favorite|a\.ppy\.sh/);
  });

  it("seeds a plain rating only from entries without rating mods", () => {
    const { meta } = readOtdbExport([
      entry(1, [connection("DT1", 10, 7.1, ["DT"]), connection("HR1", 11, 6.3, ["HR"])]),
      entry(2, [connection("HD1", 10, 5.2, ["HD"]), connection("NM1", 12, 4.9, [])]),
      entry(3, [connection("NM1", 12, 9.9, []), connection("FM1", 13, 5.0, ["FM"])]),
      entry(4, [connection("EZ1", 14, 3.0, ["ez"]), connection("NC1", 15, 7.0, ["NC"])]),
    ]);
    expect(meta.get(10)).toEqual({ mode: "osu", lengthSeconds: 100, bpm: 150, starRating: 5.2 });
    expect(meta.get(11)?.starRating).toBeNull();
    // The first plain rating stays.
    expect(meta.get(12)?.starRating).toBe(4.9);
    expect(meta.get(13)?.starRating).toBe(5);
    expect(meta.get(14)?.starRating).toBeNull();
    expect(meta.get(15)?.starRating).toBeNull();
  });

  it("skips entries that don't match the export's format", () => {
    const { pools, skipped } = readOtdbExport([
      entry(1, [connection("NM1", 5, 5, [])]),
      { id: 2, name: "No maps field" },
      { name: "No id", beatmap_connections: [] },
      "not a pool",
      entry(3, [{ slot: "NM1", beatmap: { star_rating: 5, mods: [] } }]),
    ]);
    expect(pools.map((pool) => pool.source.id)).toEqual(["1"]);
    expect(skipped).toEqual([
      {
        kind: "otdb",
        id: "2",
        name: "No maps field",
        reason: "Doesn't match the otdb export's format.",
      },
      {
        kind: "otdb",
        id: "entry 3",
        name: "No id",
        reason: "Doesn't match the otdb export's format.",
      },
      { kind: "otdb", id: "entry 4", name: "", reason: "Doesn't match the otdb export's format." },
      {
        kind: "otdb",
        id: "3",
        name: "Cup 3 Finals",
        reason: "Doesn't match the otdb export's format.",
      },
    ]);
  });

  it("refuses an export that isn't a list", () => {
    expect(() => readOtdbExport({ pools: [] })).toThrow("The otdb export isn't a list of pools.");
  });
});

describe("the sample through normalizePools", () => {
  const read = readOtdbExport(SAMPLE);
  const { pools, skipped } = normalizePools(read.pools, read.meta, new Date());
  const byId = (id: string) => pools.find((pool) => pool.source.id === id);

  it("skips the pool with a slot listed twice, and the EZ World Cup pools that mix mods", () => {
    expect(skipped).toEqual([
      {
        kind: "otdb",
        id: "481",
        name: "Lobby 42: Roulette Team Solos Round of 16",
        reason: "Slot DT1: DT1 appears more than once.",
      },
      {
        kind: "otdb",
        id: "665",
        name: "EZ World Cup Qualifiers",
        reason:
          "Maps without a slot are played with mods (EZHT, EZ, EZDT), which a map without a slot can't hold.",
      },
      {
        kind: "otdb",
        id: "670",
        name: "EZ World Cup Finals",
        reason:
          "Slot S: its maps are played with different mods (EZ, EZDT, EZHT), which one slot can't hold.",
      },
    ]);
    expect(pools).toHaveLength(19);
  });

  it("reads custom labels and their mods, with the EZ every map carries", () => {
    expect(byId("641")?.input.buckets?.filter((entry) => "color" in entry)).toEqual([
      { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
      { code: "EZHD", color: 1, mods: { kind: "forced", set: ["EZ", "HD"] } },
      { code: "EZDT", color: 2, mods: { kind: "forced", set: ["EZ", "DT"] } },
      { code: "EZHDDT", color: 3, mods: { kind: "forced", set: ["EZ", "HD", "DT"] } },
      { code: "EZHT", color: 4, mods: { kind: "forced", set: ["EZ", "HT"] } },
      { code: "EZHDHT", color: 5, mods: { kind: "forced", set: ["EZ", "HD", "HT"] } },
    ]);
  });

  it("gives the two pairs of identical pools the same fingerprints", () => {
    expect(byId("418")?.fingerprint).toBe(byId("71")?.fingerprint);
    expect(byId("445")?.fingerprint).toBe(byId("283")?.fingerprint);
    expect(new Set(pools.map((pool) => pool.fingerprint)).size).toBe(17);
  });

  it("seeds stats without osu! lookups, incomplete until ratings with mods exist", () => {
    const owc = byId("657");
    expect(owc?.archive).toEqual({
      tournament: "osu! World Cup 2023",
      round: "Grand Finals",
      year: 2023,
    });
    expect(owc?.stats).toMatchObject({ modes: ["osu"], complete: false, count: 20 });
    expect(owc?.stats.lenMin).toEqual(expect.any(Number));
    expect(owc?.stats.srMin).toEqual(expect.any(Number));
  });
});
