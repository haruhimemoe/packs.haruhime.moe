/**
 * @file tests/unit/utils/map-usage.test.ts
 * @desc Map usage from archive packs: each slot's mods code, reading stored pack rows (bad ones
 *       left out), one entry per slot, the order (newest year first, no year last), counting
 *       pools not slots, stored entries that don't parse, the fewest writes for a rebuild, and
 *       what a map row shows (its own pack and its own pool left out, "Used in N pools", each
 *       pool's text), and the text a fingerprint hashes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import type { MapUsageEntry } from "@/schemas/map-usage";
import type { BucketEntry, PoolSlot } from "@/schemas/pack";
import {
  buildMapUsage,
  compareUsageEntries,
  fingerprintText,
  packUsage,
  planUsageWrites,
  sameUsage,
  slotModsCode,
  storedUsageEntries,
  toBeatmapUsage,
  type UsagePack,
  usageElsewhere,
  usageEntryText,
  usageLabel,
  usagePackOf,
  usagePoolCount,
} from "@/utils/map-usage";

const PRINT = "f".repeat(64);
const ARCHIVE = {
  tournament: "Spring Cup",
  round: "Finals",
  year: 2024,
  badged: null,
  fingerprint: PRINT,
};

const pack = (slug: string, slots: PoolSlot[], archive: Partial<UsagePack["archive"]> = {}) => ({
  slug,
  slots,
  archive: { ...ARCHIVE, ...archive },
});

const entry = (overrides: Partial<MapUsageEntry> = {}): MapUsageEntry => ({
  slug: "aaaaaaaaaa",
  tournament: "Spring Cup",
  round: "Finals",
  year: 2024,
  badged: null,
  slot: "NM1",
  mods: "NM",
  fingerprint: PRINT,
  ...overrides,
});

const CUSTOM: BucketEntry[] = [
  { code: "NM" },
  { code: "HD" },
  { code: "HR" },
  { code: "DT" },
  { code: "FM" },
  { code: "HDHR", color: 0, mods: { kind: "forced", set: ["HD", "HR"] } },
  { code: "Free", color: 1, mods: { kind: "free" } },
  { code: "SV", color: 2 },
  { code: "TB" },
];

describe("slotModsCode", () => {
  it.each([
    [{ mod: "HR", index: 1, beatmapId: 1 }, undefined, "HR"],
    [{ mod: "TB", index: 1, beatmapId: 1 }, { kind: "free" } as const, "TB"],
    [
      { mod: "HDHR", index: 1, beatmapId: 1 },
      { kind: "forced", set: ["HD", "HR"] } as const,
      "HDHR",
    ],
    [{ mod: "Free", index: 1, beatmapId: 1 }, { kind: "free" } as const, "FM"],
    [{ mod: "SV", index: 1, beatmapId: 1 }, { kind: "none" } as const, "NM"],
    [{ mod: null, index: 4, beatmapId: 1 }, undefined, "NM"],
  ])("writes %j with %j as %s", (slot, mods, code) => {
    expect(slotModsCode(slot, mods)).toBe(code);
  });
});

describe("usagePackOf", () => {
  const row = {
    slug: "aaaaaaaaaa",
    slots: [{ mod: "NM", index: 1, beatmapId: 75 }],
    archive: {
      tournament: "Spring Cup",
      round: "Finals",
      year: 2024,
      badged: true,
      fingerprint: PRINT,
    },
  };

  it("reads a stored archive pack", () => {
    expect(usagePackOf(row)).toEqual(row);
  });

  it("reads missing round, year and badged as null, and an empty bucket list as the default", () => {
    expect(
      usagePackOf({
        ...row,
        buckets: [],
        archive: { tournament: "Spring Cup", fingerprint: PRINT },
      }),
    ).toEqual({
      ...row,
      archive: {
        tournament: "Spring Cup",
        round: null,
        year: null,
        badged: null,
        fingerprint: PRINT,
      },
    });
  });

  it("keeps a custom bucket list, dropping Mongoose's null colors on built-ins", () => {
    const buckets = CUSTOM.map((bucket) =>
      "color" in bucket ? bucket : { ...bucket, color: null },
    );
    expect(usagePackOf({ ...row, buckets })?.buckets).toEqual(CUSTOM);
  });

  it.each([
    ["no archive details", { ...row, archive: undefined }],
    ["null archive details", { ...row, archive: null }],
    ["a bad slug", { ...row, slug: "short" }],
    ["bad slots", { ...row, slots: [{ mod: "NM", index: 1 }] }],
    ["no tournament", { ...row, archive: { ...row.archive, tournament: "" } }],
    ["a bad year", { ...row, archive: { ...row.archive, year: "2024" } }],
    ["no fingerprint", { ...row, archive: { ...row.archive, fingerprint: undefined } }],
    ["a bad fingerprint", { ...row, archive: { ...row.archive, fingerprint: "abc" } }],
  ])("leaves out a row with %s", (_label, doc) => {
    expect(usagePackOf(doc)).toBeNull();
  });
});

describe("packUsage", () => {
  it("gives one entry per slot with its label and mods", () => {
    const slots: PoolSlot[] = [
      { mod: "NM", index: 1, beatmapId: 10 },
      { mod: "HDHR", index: 2, beatmapId: 11 },
      { mod: "Free", index: 1, beatmapId: 12 },
      { mod: "SV", index: 1, beatmapId: 13 },
      { mod: "TB", index: 1, beatmapId: 10 },
      { mod: null, index: 4, beatmapId: 14 },
    ];
    const usage = packUsage({ ...pack("aaaaaaaaaa", slots), buckets: CUSTOM });
    expect(usage.map(({ beatmapId, entry }) => [beatmapId, entry.slot, entry.mods])).toEqual([
      [10, "NM1", "NM"],
      [11, "HDHR2", "HDHR"],
      [12, "Free1", "FM"],
      [13, "SV1", "NM"],
      [10, "TB1", "TB"],
      [14, "4", "NM"],
    ]);
    expect(usage[0]?.entry).toEqual(entry({ slot: "NM1" }));
  });
});

describe("fingerprintText", () => {
  it("is each slot as beatmapId:mods, sorted, one per line: what a fingerprint hashes", () => {
    const slots: PoolSlot[] = [
      { mod: "TB", index: 1, beatmapId: 3 },
      { mod: "HDHR", index: 2, beatmapId: 11 },
      { mod: "NM", index: 1, beatmapId: 10 },
      { mod: null, index: 4, beatmapId: 14 },
    ];
    expect(fingerprintText({ slots, buckets: CUSTOM })).toBe("10:NM\n11:HDHR\n14:NM\n3:TB");
  });
});

describe("compareUsageEntries", () => {
  it("puts the newest year first and entries without a year last", () => {
    const sorted = [
      entry({ year: null, tournament: "A" }),
      entry({ year: 2019 }),
      entry({ year: 2024 }),
      entry({ year: null, tournament: "B" }),
      entry({ year: 2021 }),
    ].sort(compareUsageEntries);
    expect(sorted.map((e) => [e.year, e.tournament])).toEqual([
      [2024, "Spring Cup"],
      [2021, "Spring Cup"],
      [2019, "Spring Cup"],
      [null, "A"],
      [null, "B"],
    ]);
  });

  it("then goes by tournament, round (none first), slug and slot", () => {
    const sorted = [
      entry({ tournament: "B" }),
      entry({ round: "Semifinals" }),
      entry({ slug: "bbbbbbbbbb", slot: "HD1" }),
      entry({ slug: "bbbbbbbbbb", slot: "DT1" }),
      entry({ round: null }),
      entry({ tournament: "A" }),
    ].sort(compareUsageEntries);
    expect(sorted.map((e) => [e.tournament, e.round, e.slug, e.slot])).toEqual([
      ["A", "Finals", "aaaaaaaaaa", "NM1"],
      ["B", "Finals", "aaaaaaaaaa", "NM1"],
      ["Spring Cup", null, "aaaaaaaaaa", "NM1"],
      ["Spring Cup", "Finals", "bbbbbbbbbb", "DT1"],
      ["Spring Cup", "Finals", "bbbbbbbbbb", "HD1"],
      ["Spring Cup", "Semifinals", "aaaaaaaaaa", "NM1"],
    ]);
    expect(compareUsageEntries(entry(), entry())).toBe(0);
  });
});

describe("buildMapUsage", () => {
  const packs = [
    pack("aaaaaaaaaa", [
      { mod: "NM", index: 1, beatmapId: 1 },
      { mod: "HD", index: 1, beatmapId: 2 },
    ]),
    pack(
      "bbbbbbbbbb",
      [
        { mod: "NM", index: 1, beatmapId: 2 },
        { mod: "TB", index: 1, beatmapId: 2 },
      ],
      { tournament: "Autumn Cup", year: 2025, round: null },
    ),
  ];

  it("gathers every pack's entries by beatmap id, sorted", () => {
    const usage = buildMapUsage(packs);
    expect([...usage.keys()].sort()).toEqual([1, 2]);
    expect(usage.get(2)?.map((e) => [e.slug, e.slot])).toEqual([
      ["bbbbbbbbbb", "NM1"],
      ["bbbbbbbbbb", "TB1"],
      ["aaaaaaaaaa", "HD1"],
    ]);
  });

  it("keeps only the ids asked for", () => {
    expect([...buildMapUsage(packs, new Set([1, 3])).keys()]).toEqual([1]);
  });

  it("gives nothing for no packs", () => {
    expect(buildMapUsage([]).size).toBe(0);
  });
});

describe("storedUsageEntries", () => {
  it("keeps entries that parse and drops the rest", () => {
    expect(
      storedUsageEntries([entry(), { ...entry(), slug: 5 }, null, entry({ slot: "HD1" })]),
    ).toEqual([entry(), entry({ slot: "HD1" })]);
  });

  it.each([undefined, null, "entries", {}])("reads %j as none", (value) => {
    expect(storedUsageEntries(value)).toEqual([]);
  });
});

describe("usagePoolCount and toBeatmapUsage", () => {
  it("counts pools, not slots", () => {
    const entries = [entry(), entry({ slot: "TB1", mods: "TB" }), entry({ slug: "bbbbbbbbbb" })];
    expect(usagePoolCount(entries)).toBe(2);
    expect(toBeatmapUsage(75, entries)).toEqual({ beatmapId: 75, count: 2, entries });
    expect(toBeatmapUsage(75, [])).toEqual({ beatmapId: 75, count: 0, entries: [] });
  });

  it("copies the entries", () => {
    const entries = [entry()];
    expect(toBeatmapUsage(1, entries).entries).not.toBe(entries);
  });
});

describe("planUsageWrites", () => {
  it("writes new and changed maps, removes unused ones, and skips the rest", () => {
    const stored = new Map<number, MapUsageEntry[]>([
      [1, [entry()]],
      [2, [entry()]],
      [3, [entry()]],
      [4, [entry(), entry({ slot: "HD1" })]],
    ]);
    const next = new Map<number, MapUsageEntry[]>([
      [1, [entry()]],
      [2, [entry({ badged: true })]],
      [4, [entry()]],
      [5, [entry()]],
    ]);
    expect(planUsageWrites([1, 2, 3, 4, 5, 6, 5], stored, next)).toEqual({
      set: [
        [2, [entry({ badged: true })]],
        [4, [entry()]],
        [5, [entry()]],
      ],
      remove: [3],
    });
  });

  it.each(["slug", "tournament", "round", "year", "slot", "mods"] as const)(
    "sees a change in %s",
    (field) => {
      const changed = { ...entry(), [field]: field === "year" ? 2020 : "X" } as MapUsageEntry;
      const plan = planUsageWrites([1], new Map([[1, [entry()]]]), new Map([[1, [changed]]]));
      expect(plan.set).toEqual([[1, [changed]]]);
    },
  );

  it("treats an empty list as unused", () => {
    expect(planUsageWrites([1], new Map([[1, [entry()]]]), new Map([[1, []]]))).toEqual({
      set: [],
      remove: [1],
    });
  });
});

describe("sameUsage", () => {
  it("is true only for the same ids with the same entries in the same order", () => {
    const one = new Map([[1, [entry()]]]);
    expect(sameUsage(one, new Map([[1, [entry()]]]))).toBe(true);
    expect(sameUsage(one, new Map())).toBe(false);
    expect(sameUsage(one, new Map([[2, [entry()]]]))).toBe(false);
    expect(sameUsage(one, new Map([[1, [entry({ slot: "NM2" })]]]))).toBe(false);
    expect(sameUsage(one, new Map([[1, [entry(), entry()]]]))).toBe(false);
  });
});

describe("what a map row shows", () => {
  it("leaves out the pack being shown, by slug", () => {
    const entries = [entry(), entry({ slug: "bbbbbbbbbb", fingerprint: "b".repeat(64) })];
    expect(usageElsewhere(entries, { slug: "aaaaaaaaaa" })).toEqual([entries[1]]);
    expect(usageElsewhere(entries, {})).toBe(entries);
  });

  it("leaves out the pool being shown, by fingerprint: a key, a copy, any pack with its maps", () => {
    const entries = [entry(), entry({ slug: "bbbbbbbbbb", fingerprint: "b".repeat(64) })];
    expect(usageElsewhere(entries, { fingerprint: PRINT })).toEqual([entries[1]]);
    expect(usageElsewhere(entries, { slug: "bbbbbbbbbb", fingerprint: PRINT })).toEqual([]);
  });

  it.each([
    [1, "Used in 1 pool"],
    [2, "Used in 2 pools"],
    [12, "Used in 12 pools"],
  ])("labels %i as %j", (pools, label) => {
    expect(usageLabel(pools)).toBe(label);
  });

  it.each([
    [entry(), "Spring Cup · Finals", "2024 · NM1"],
    [entry({ round: null }), "Spring Cup", "2024 · NM1"],
    [entry({ year: null, slot: "4" }), "Spring Cup · Finals", "4"],
  ])("writes %j as %j and %j", (value, pool, details) => {
    expect(usageEntryText(value)).toEqual({ pool, details });
  });
});
