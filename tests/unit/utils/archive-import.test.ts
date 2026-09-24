/**
 * @file tests/unit/utils/archive-import.test.ts
 * @desc Planning an archive import against stored archive packs (new, a new source on a stored
 *       pack, unchanged, the same pool twice in one import, a changed pool, skipped), the
 *       runner's arguments, and the summary it prints.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import {
  type ExistingArchivePack,
  formatImportReport,
  parseImportArgs,
  planArchiveImport,
  sourceKey,
} from "@/utils/archive-import";
import {
  type ArchiveSourceRef,
  type NormalizedPool,
  normalizePool,
  type SkippedPool,
} from "@/utils/archive-pools";
import { otdbSource } from "@/utils/otdb";

const NOW = new Date("2026-09-24T12:00:00.000Z");

/** A normalized pool of the given maps (all NM). */
const pool = (source: ArchiveSourceRef, name: string, ...maps: number[]): NormalizedPool => {
  const result = normalizePool(
    { source, name, slots: maps.map((beatmapId, i) => ({ label: `NM${i + 1}`, beatmapId })) },
    new Map(),
    NOW,
  );
  if (!result.ok) throw new Error(result.skipped.reason);
  return result.pool;
};

const otr = (id: string): ArchiveSourceRef => ({
  kind: "otr",
  id,
  url: `https://otr.example/pools/${id}`,
});

const stored = (slug: string, from: NormalizedPool, ...sources: ArchiveSourceRef[]) =>
  ({
    slug,
    name: from.input.name,
    fingerprint: from.fingerprint,
    sources: (sources.length > 0 ? sources : [from.source]).map(({ kind, id }) => ({ kind, id })),
  }) satisfies ExistingArchivePack;

const SKIPPED: SkippedPool = { kind: "otdb", id: "9", name: "Bad Cup", reason: "No maps." };

describe("planArchiveImport", () => {
  it("creates every pool into an empty archive, keeping skipped pools", () => {
    const a = pool(otdbSource(1), "A Cup Finals", 1, 2);
    const b = pool(otdbSource(2), "B Cup Finals", 3);
    const plan = planArchiveImport([a, b], [SKIPPED], []);
    expect(plan).toEqual({
      create: [
        { pool: a, sources: [a.source] },
        { pool: b, sources: [b.source] },
      ],
      update: [],
      unchanged: [],
      merged: [],
      changed: [],
      skipped: [SKIPPED],
    });
  });

  it("leaves a stored pack that already has the source unchanged", () => {
    const a = pool(otdbSource(1), "A Cup Finals", 1, 2);
    const plan = planArchiveImport([a], [], [stored("aaaaaaaaaa", a)]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.unchanged).toEqual([
      { slug: "aaaaaaaaaa", name: "A Cup Finals", source: a.source },
    ]);
  });

  it("adds a second source's copy of a stored pool to that pack, once", () => {
    const fromOtdb = pool(otdbSource(1), "A Cup Finals", 1, 2);
    const fromOtr = pool(otr("77"), "A Cup 2024 GF", 2, 1);
    expect(fromOtr.fingerprint).toBe(fromOtdb.fingerprint);
    const plan = planArchiveImport([fromOtr, fromOtr], [], [stored("aaaaaaaaaa", fromOtdb)]);
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([
      { slug: "aaaaaaaaaa", name: "A Cup Finals", sources: [fromOtr.source] },
    ]);
  });

  it("makes the same pool twice in one import one new pack with both sources", () => {
    const first = pool(otdbSource(71), "United States Cup 2017 Quarter Finals", 1, 2);
    const again = pool(otdbSource(418), "USA States Cup 2017 Quarterfinals", 2, 1);
    const plan = planArchiveImport([first, again, again], [], []);
    expect(plan.create).toEqual([{ pool: first, sources: [first.source, again.source] }]);
    expect(plan.merged).toEqual([
      {
        source: again.source,
        into: first.source,
        name: "United States Cup 2017 Quarter Finals",
      },
    ]);
  });

  it("flags a source whose pool changed: a new pack, and the old one stays", () => {
    const before = pool(otdbSource(5), "C Cup Finals", 1, 2);
    const after = pool(otdbSource(5), "C Cup Finals", 1, 3);
    const plan = planArchiveImport([after], [], [stored("cccccccccc", before)]);
    expect(plan.create).toEqual([{ pool: after, sources: [after.source] }]);
    expect(plan.changed).toEqual([
      {
        source: after.source,
        from: { slug: "cccccccccc", name: "C Cup Finals" },
        to: { slug: null, name: "C Cup Finals" },
      },
    ]);
  });

  it("flags a changed pool that now matches another stored pack", () => {
    const before = pool(otdbSource(5), "C Cup Finals", 1, 2);
    const other = pool(otr("8"), "D Cup Finals", 4);
    const after = pool(otdbSource(5), "C Cup Finals", 4);
    const plan = planArchiveImport(
      [after],
      [],
      [stored("cccccccccc", before), stored("dddddddddd", other)],
    );
    expect(plan.update).toEqual([
      { slug: "dddddddddd", name: "D Cup Finals", sources: [after.source] },
    ]);
    expect(plan.changed).toEqual([
      {
        source: after.source,
        from: { slug: "cccccccccc", name: "C Cup Finals" },
        to: { slug: "dddddddddd", name: "D Cup Finals" },
      },
    ]);
  });

  it("doesn't flag a changed pool again once its new pack has the source", () => {
    const before = pool(otdbSource(5), "C Cup Finals", 1, 2);
    const after = pool(otdbSource(5), "C Cup Finals", 1, 3);
    const plan = planArchiveImport(
      [after],
      [],
      [stored("cccccccccc", before), stored("eeeeeeeeee", after)],
    );
    expect(plan.unchanged).toHaveLength(1);
    expect(plan.changed).toEqual([]);
  });

  it("keys sources by kind and id", () => {
    expect(sourceKey({ kind: "otdb", id: "58" })).toBe("otdb:58");
  });
});

describe("parseImportArgs", () => {
  it.each([
    [["otdb"], { source: "otdb", dryRun: false, file: null }],
    [["otdb", "--dry-run"], { source: "otdb", dryRun: true, file: null }],
    [["--dry-run", "otdb", "--file", "x.json"], { source: "otdb", dryRun: true, file: "x.json" }],
    [["otdb", "--file=./export.json"], { source: "otdb", dryRun: false, file: "./export.json" }],
  ])("reads %j", (argv, args) => {
    expect(parseImportArgs(argv)).toEqual({ ok: true, args });
  });

  it.each([
    [[], "Name a source to import from."],
    [["otr"], "Can't import from otr. Sources: otdb."],
    [["otdb", "otdb"], "Only one source at a time (got otdb and otdb)."],
    [["otdb", "--dry-run", "--dry-run"], "--dry-run is given twice."],
    [["otdb", "--file"], "--file needs a path."],
    [["otdb", "--file", "--dry-run"], "--file needs a path."],
    [["otdb", "--file="], "--file needs a path."],
    [["otdb", "--file", "a", "--file", "b"], "--file is given twice."],
    [["otdb", "--force"], "Unknown option --force."],
  ])("refuses %j", (argv, error) => {
    expect(parseImportArgs(argv)).toEqual({ ok: false, error });
  });
});

describe("formatImportReport", () => {
  it("prints the counts and every skipped, merged, changed and updated pool", () => {
    const a = pool(otdbSource(71), "United States Cup 2017 Quarter Finals", 1, 2);
    const merged = pool(otdbSource(418), "USA States Cup 2017 Quarterfinals", 1, 2);
    const before = pool(otdbSource(5), "C Cup Finals", 7);
    const after = pool(otdbSource(5), "C Cup Finals", 8);
    const known = pool(otr("3"), "D Cup Finals", 9);
    const gains = pool(otdbSource(6), "D Cup Finals", 9);
    const plan = planArchiveImport(
      [a, merged, after, gains],
      [SKIPPED],
      [stored("cccccccccc", before), stored("dddddddddd", known)],
    );
    expect(formatImportReport(plan, { read: 6, dryRun: true, source: "otdb" })).toBe(
      [
        "otdb: 6 pools read. Dry run: nothing was written.",
        "",
        "  New packs                 2",
        "  Updated (new source)      1",
        "  Unchanged                 0",
        "  Same pool twice           1",
        "  Changed pools             1",
        "  Skipped                   1",
        "",
        "Skipped:",
        "  otdb #9  Bad Cup: No maps.",
        "",
        "Same pool twice in this import (one pack with both sources):",
        "  otdb #418 is the same pool as otdb #71 (United States Cup 2017 Quarter Finals)",
        "",
        "Changed pools (the old pack stays):",
        "  otdb #5  was cccccccccc (C Cup Finals), now a new pack (C Cup Finals)",
        "",
        "New sources on stored packs:",
        "  dddddddddd (D Cup Finals) gains otdb #6",
      ].join("\n"),
    );
  });

  it("prints only the counts when nothing else happened, and one pool read", () => {
    const plan = planArchiveImport([], [], []);
    const report = formatImportReport(plan, { read: 1, dryRun: false, source: "otdb" });
    expect(report.split("\n")[0]).toBe("otdb: 1 pool read.");
    expect(report).not.toContain("Skipped:");
    expect(report.split("\n")).toHaveLength(8);
  });

  it("names a changed pool's stored pack when it went to one", () => {
    const before = pool(otdbSource(5), "C Cup Finals", 1);
    const other = pool(otr("8"), "D Cup Finals", 4);
    const after = pool(otdbSource(5), "C Cup Finals", 4);
    const plan = planArchiveImport(
      [after],
      [],
      [stored("cccccccccc", before), stored("dddddddddd", other)],
    );
    expect(formatImportReport(plan, { read: 1, dryRun: false, source: "otdb" })).toContain(
      "otdb #5  was cccccccccc (C Cup Finals), now dddddddddd (D Cup Finals)",
    );
  });
});
