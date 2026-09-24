/**
 * @file tests/unit/utils/archive-pools.test.ts
 * @desc Source pools to archive packs: custom slot mods from their codes, slot labels through the
 *       pasted-pool parser (numbered maps, custom labels, and every way a pool is refused),
 *       fingerprints (order-independent, mods-sensitive), validation and the content filter,
 *       seeded stats, and id order. (The blocked name below is a test input only.)
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { BucketEntry, PoolSlot } from "@/schemas/pack";
import {
  archiveDescription,
  modsFromSlotCode,
  normalizePool,
  normalizePools,
  poolFingerprint,
  poolFromLabels,
  type SourcePool,
} from "@/utils/archive-pools";
import { fingerprintText } from "@/utils/map-usage";
import { otdbSource } from "@/utils/otdb";
import type { StatsMeta } from "@/utils/saved-pack-stats";

const NOW = new Date("2026-09-24T12:00:00.000Z");

const labelled = (...labels: string[]) =>
  labels.map((label, i) => ({ label, beatmapId: 1000 + i }));

const source = (id: number, name: string, labels: string[]): SourcePool => ({
  source: otdbSource(id),
  name,
  slots: labelled(...labels),
});

describe("modsFromSlotCode", () => {
  it.each([
    ["EZ", ["EZ"]],
    ["HDHR", ["HD", "HR"]],
    ["dthd", ["HD", "DT"]],
    ["HDHT", ["HD", "HT"]],
    ["EZHDDT", ["EZ", "HD", "DT"]],
  ])("reads %s", (code, set) => {
    expect(modsFromSlotCode(code)).toEqual(set);
  });

  it.each(["S", "C", "SV", "EZHR", "DTHT", "HDHD", "EZHDDTFL", "NM", "HD1", "FMHD"])(
    "gives no mods for %s",
    (code) => {
      expect(modsFromSlotCode(code)).toBeNull();
    },
  );
});

describe("poolFromLabels", () => {
  it("reads built-in labels, keeps the source's order, and adds no bucket list", () => {
    const result = poolFromLabels("Cup Finals", labelled("NM1", "hd2", "HR 1", "DT1", "FM1", "TB"));
    expect(result).toEqual({
      ok: true,
      pool: {
        name: "Cup Finals",
        slots: [
          { mod: "NM", index: 1, beatmapId: 1000 },
          { mod: "HD", index: 2, beatmapId: 1001 },
          { mod: "HR", index: 1, beatmapId: 1002 },
          { mod: "DT", index: 1, beatmapId: 1003 },
          { mod: "FM", index: 1, beatmapId: 1004 },
          { mod: "TB", index: 1, beatmapId: 1005 },
        ],
      },
    });
  });

  it("makes custom slots, forcing the mods a code spells", () => {
    const result = poolFromLabels("EZ Cup", labelled("EZ1", "HDDT1", "S1", "C10", "TB1"));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.pool.buckets?.filter((entry) => "color" in entry)).toEqual([
      { code: "EZ", color: 0, mods: { kind: "forced", set: ["EZ"] } },
      { code: "HDDT", color: 1, mods: { kind: "forced", set: ["HD", "DT"] } },
      { code: "S", color: 2 },
      { code: "C", color: 3 },
    ]);
    expect(result.pool.slots.map((slot) => `${slot.mod}${slot.index}`)).toEqual([
      "EZ1",
      "HDDT1",
      "S1",
      "C10",
      "TB1",
    ]);
  });

  it("reads numbered labels as maps without a slot, in place", () => {
    const result = poolFromLabels("Quals", labelled("#1", "#2", "NM1", "12"));
    expect(result.ok && result.pool.slots).toEqual([
      { mod: null, index: 1, beatmapId: 1000 },
      { mod: null, index: 2, beatmapId: 1001 },
      { mod: "NM", index: 1, beatmapId: 1002 },
      { mod: null, index: 12, beatmapId: 1003 },
    ]);
  });

  it.each([
    [["NM1", "DT1", "DT1"], "Slot DT1: DT1 appears more than once."],
    [["#1", "1"], "No slot 1 appears more than once."],
    [["NM1", ""], "A map has no slot label."],
    [["NM1\nHD1"], 'The slot label "NM1\\nHD1" has a line break.'],
    [["#0"], "Slot #0: slot numbers go from 1 to 99."],
    [["#100"], "Slot #100: slot numbers go from 1 to 99."],
    [["#A"], "A slot label couldn't be read."],
    [["NM0"], "Slot NM0: Slot numbers go from 1 to 99."],
    [["Tie Breaker"], "Slot Tie Breaker: Paste a beatmap ID or an osu.ppy.sh beatmap link."],
    [
      ["A1", "B1", "C1", "D1", "E1", "F1", "G1", "H1", "I1"],
      "Slot I1: This pool already has 8 custom slots.",
    ],
  ])("refuses %j: %s", (labels, reason) => {
    expect(poolFromLabels("Cup", labelled(...labels))).toEqual({ ok: false, reason });
  });
});

describe("poolFingerprint", () => {
  const slots: PoolSlot[] = [
    { mod: "NM", index: 1, beatmapId: 1 },
    { mod: "HD", index: 1, beatmapId: 2 },
    { mod: "TB", index: 1, beatmapId: 3 },
  ];

  it("hashes fingerprintText, so the browser gets the same one from a pool", () => {
    expect(poolFingerprint({ slots })).toBe(
      createHash("sha256").update(fingerprintText({ slots }), "utf8").digest("hex"),
    );
  });

  it("is sha256 hex and ignores slot order, labels and colors", () => {
    const print = poolFingerprint({ slots });
    expect(print).toMatch(/^[0-9a-f]{64}$/);
    expect(poolFingerprint({ slots: [...slots].reverse() })).toBe(print);
    expect(
      poolFingerprint({
        slots: slots.map((slot) => (slot.mod === "NM" ? { ...slot, index: 5 } : slot)),
      }),
    ).toBe(print);
  });

  it("changes with the maps and with their mods", () => {
    const print = poolFingerprint({ slots });
    expect(poolFingerprint({ slots: [...slots, { mod: "HR", index: 1, beatmapId: 4 }] })).not.toBe(
      print,
    );
    expect(
      poolFingerprint({
        slots: slots.map((slot) => (slot.beatmapId === 2 ? { ...slot, mod: "HR" } : slot)),
      }),
    ).not.toBe(print);
    expect(
      poolFingerprint({
        slots: slots.map((slot) => (slot.beatmapId === 3 ? { ...slot, mod: "FM" } : slot)),
      }),
    ).not.toBe(print);
  });

  it("writes custom slots by what they play with, so a label doesn't matter", () => {
    const forcedHd = poolFromLabels("A", labelled("HD1"));
    const customHd = poolFromLabels("A", [{ label: "Hidden1", beatmapId: 1000 }]);
    expect(forcedHd.ok && customHd.ok).toBe(true);
    if (!forcedHd.ok || !customHd.ok) return;
    // A custom slot without mods counts as NM, like a map without a slot.
    expect(poolFingerprint(customHd.pool)).toBe(
      poolFingerprint({ slots: [{ mod: "NM", index: 1, beatmapId: 1000 }] }),
    );
    expect(poolFingerprint({ slots: [{ mod: null, index: 1, beatmapId: 1000 }] })).toBe(
      poolFingerprint(customHd.pool),
    );
    const hdhr = poolFromLabels("A", labelled("HDHR1"));
    const hdhrOther = poolFromLabels("A", labelled("HRHD2"));
    expect(hdhr.ok && hdhrOther.ok && poolFingerprint(hdhr.pool)).toBe(
      hdhrOther.ok && poolFingerprint(hdhrOther.pool),
    );
    expect(hdhr.ok && poolFingerprint(hdhr.pool)).not.toBe(poolFingerprint(forcedHd.pool));
    const buckets: BucketEntry[] = [
      { code: "NM" },
      { code: "HD" },
      { code: "HR" },
      { code: "DT" },
      { code: "FM" },
      { code: "X", color: 0, mods: { kind: "free" } },
      { code: "TB" },
    ];
    const free = { slots: [{ mod: "X", index: 1, beatmapId: 1000 }], buckets };
    expect(poolFingerprint(free)).toBe(
      poolFingerprint({ slots: [{ mod: "FM", index: 1, beatmapId: 1000 }] }),
    );
  });
});

describe("normalizePool", () => {
  const meta = new Map<number, StatsMeta>([
    [1000, { mode: "osu", lengthSeconds: 120, bpm: 180, starRating: 5.5 }],
    [1001, { mode: "osu", lengthSeconds: 200, bpm: 150, starRating: null }],
  ]);

  it("gives the pack input, archive details, fingerprint and seeded stats", () => {
    const result = normalizePool(
      source(657, "osu! World Cup 2023 Grand Finals", ["NM1", "DT1"]),
      meta,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { pool } = result;
    expect(pool.input).toEqual({
      name: "osu! World Cup 2023 Grand Finals",
      slots: [
        { mod: "NM", index: 1, beatmapId: 1000 },
        { mod: "DT", index: 1, beatmapId: 1001 },
      ],
      visibility: "public",
      description: "Archived from otdb pool #657: https://otdb.sheppsu.me/db/mappools/657/",
    });
    expect(pool.archive).toEqual({
      tournament: "osu! World Cup 2023",
      round: "Grand Finals",
      year: 2023,
    });
    expect(pool.fingerprint).toBe(poolFingerprint(pool.input));
    // The DT map's rating with mods isn't known yet: its stars are missing, not guessed.
    expect(pool.stats).toEqual({
      srMin: 5.5,
      srMax: 5.5,
      srAvg: 5.5,
      lenMin: 120,
      lenMax: 133,
      bpmMin: 180,
      bpmMax: 225,
      mods: ["NM", "DT"],
      modes: ["osu"],
      count: 2,
      complete: false,
      computedAt: NOW,
    });
  });

  it("gives complete stats when every rating that counts is known", () => {
    const result = normalizePool(source(1, "Cup Finals", ["NM1"]), meta, NOW);
    expect(result.ok && result.pool.stats.complete).toBe(true);
  });

  it.each([
    ["a name over 64 characters", source(5, "x".repeat(65), ["NM1"]), /^name: Too big/],
    ["no maps", source(6, "Empty Cup", []), /^slots: Add at least one map/],
    [
      "blocked language in the name",
      source(7, "Cup 1488 Finals", ["NM1"]),
      /^name: Please keep the name free of slurs\.$/,
    ],
    [
      "blocked language in a slot label",
      source(9, "Cup Finals", ["NM1", "F4GG0T1"]),
      /^buckets\.\d+\.code: Please keep the slot names free of slurs\.$/,
    ],
    [
      "a label the parser refuses",
      source(8, "Cup", ["NM1", "NM1"]),
      /^Slot NM1: NM1 appears more than once\.$/,
    ],
  ])("skips a pool with %s", (_label, pool, reason) => {
    const result = normalizePool(pool, meta, NOW);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.skipped).toMatchObject({ kind: "otdb", id: pool.source.id, name: pool.name });
    expect(result.skipped.reason).toMatch(reason);
  });

  it("skips a pool of more than 64 maps", () => {
    const labels = Array.from(
      { length: 65 },
      (_, i) => `${["NM", "HD", "HR", "DT", "FM"][i % 5]}${Math.floor(i / 5) + 1}`,
    );
    const result = normalizePool(source(9, "Huge Cup", labels), meta, NOW);
    expect(!result.ok && result.skipped.reason).toMatch(/^slots: Too big/);
  });
});

describe("normalizePools", () => {
  it("orders pools by id and keeps the first of an id listed twice", () => {
    const { pools, skipped } = normalizePools(
      [
        source(20, "B Cup Finals", ["NM1"]),
        source(3, "A Cup Finals", ["NM1"]),
        source(20, "B Cup Finals again", ["HD1"]),
        source(4, "Bad Cup", ["NM1", "NM1"]),
      ],
      new Map(),
      NOW,
    );
    expect(pools.map((pool) => pool.source.id)).toEqual(["3", "20"]);
    expect(pools[1]?.input.name).toBe("B Cup Finals");
    expect(skipped).toEqual([
      expect.objectContaining({ id: "4", reason: "Slot NM1: NM1 appears more than once." }),
      expect.objectContaining({
        id: "20",
        name: "B Cup Finals again",
        reason: "The source lists this pool id twice; the first one was used.",
      }),
    ]);
  });

  it("orders ids that aren't numbers as text, after numbers", () => {
    const wybin = (id: string): SourcePool => ({
      source: { kind: "wybin", id, url: `https://example.com/${id}` },
      name: `Cup ${id}`,
      slots: labelled("NM1"),
    });
    const { pools } = normalizePools([wybin("b"), wybin("a"), wybin("b")], new Map(), NOW);
    expect(pools.map((pool) => pool.source.id)).toEqual(["a", "b"]);
  });
});

describe("archiveDescription", () => {
  it("credits the source by name with its link", () => {
    expect(archiveDescription({ kind: "otr", id: "12", url: "https://otr.example/12" })).toBe(
      "Archived from o!TR pool #12: https://otr.example/12",
    );
  });
});
