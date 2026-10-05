/**
 * @file tests/unit/utils/pack-changes.test.ts
 * @desc packChangeLines reads a pack revision's diff as lines a person would recognize.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { diffValue } from "@haruhimemoe/vcs/json";
import { describe, expect, it } from "vitest";
import { packChangeLines } from "@/utils/pack-changes";
import { PACK_CODEC, snapshotOf } from "@/utils/pack-snapshot";

describe("packChangeLines", () => {
  it("diffs a map that appears in two slots without a bad-key error", () => {
    const before = snapshotOf({
      name: "Pack",
      slots: [
        { mod: "NM", index: 1, beatmapId: 100 },
        { mod: "HD", index: 1, beatmapId: 100 },
      ],
    });
    const after = snapshotOf({
      name: "Pack",
      slots: [
        { mod: "NM", index: 1, beatmapId: 100 },
        { mod: "HD", index: 1, beatmapId: 200 },
      ],
    });
    expect(() => diffValue(before, after, PACK_CODEC)).not.toThrow();
  });

  it("reports moving NM1 to HD2 as one line", () => {
    const before = snapshotOf({ name: "Pack", slots: [{ mod: "NM", index: 1, beatmapId: 5 }] });
    const after = snapshotOf({ name: "Pack", slots: [{ mod: "HD", index: 2, beatmapId: 5 }] });
    const lines = packChangeLines(diffValue(before, after, PACK_CODEC), before, after);
    const moved = lines.filter((line) => line.kind === "moved");
    expect(moved).toHaveLength(1);
    expect(moved[0]?.text).toBe("Moved 5 from NM1 to HD2");
  });

  it("reports a bucket reorder as Reordered slots", () => {
    const before = snapshotOf({
      name: "Pack",
      slots: [],
      buckets: [
        { code: "NM" },
        { code: "HD" },
        { code: "HR" },
        { code: "DT" },
        { code: "FM" },
        { code: "TB" },
      ],
    });
    const after = snapshotOf({
      name: "Pack",
      slots: [],
      buckets: [
        { code: "HD" },
        { code: "NM" },
        { code: "HR" },
        { code: "DT" },
        { code: "FM" },
        { code: "TB" },
      ],
    });
    const lines = packChangeLines(diffValue(before, after, PACK_CODEC), before, after);
    expect(lines.some((line) => line.text === "Reordered slots")).toBe(true);
  });

  it("reports a forced-mods change on a custom slot", () => {
    const before = snapshotOf({
      name: "Pack",
      slots: [],
      buckets: [{ code: "EZ2x", color: 1, mods: { kind: "free" } }],
    });
    const after = snapshotOf({
      name: "Pack",
      slots: [],
      buckets: [{ code: "EZ2x", color: 1, mods: { kind: "forced", set: ["EZ", "DT"] } }],
    });
    const lines = packChangeLines(diffValue(before, after, PACK_CODEC), before, after);
    expect(lines.some((line) => line.text === "Changed the mods on EZ2x")).toBe(true);
  });

  it("reports a rename", () => {
    const before = snapshotOf({ name: "Old", slots: [] });
    const after = snapshotOf({ name: "New", slots: [] });
    const lines = packChangeLines(diffValue(before, after, PACK_CODEC), before, after);
    expect(lines.some((line) => line.text === "Renamed to New")).toBe(true);
  });

  it("reports added and removed slots", () => {
    const before = snapshotOf({ name: "Pack", slots: [] });
    const after = snapshotOf({ name: "Pack", slots: [{ mod: "NM", index: 1, beatmapId: 9 }] });
    const added = packChangeLines(diffValue(before, after, PACK_CODEC), before, after);
    expect(added.some((line) => line.kind === "added" && line.beatmapId === 9)).toBe(true);
    const removed = packChangeLines(diffValue(after, before, PACK_CODEC), after, before);
    expect(removed.some((line) => line.kind === "removed" && line.beatmapId === 9)).toBe(true);
  });
});
