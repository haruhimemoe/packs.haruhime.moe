/**
 * @file tests/unit/utils/pack-snapshot.test.ts
 * @desc snapshotOf keys a pack's slots so the same map in two slots diffs cleanly, and PACK_CODEC
 *       reports moves instead of set pairs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import { canonicalJson } from "@haruhimemoe/vcs";
import { diffValue, mergeValue } from "@haruhimemoe/vcs/json";
import { describe, expect, it } from "vitest";
import { PACK_CODEC, snapshotOf } from "@/utils/pack-snapshot";

describe("snapshotOf", () => {
  it("keys a map that appears in two slots without colliding", () => {
    const snapshot = snapshotOf({
      name: "Dup",
      slots: [
        { mod: "NM", index: 1, beatmapId: 100 },
        { mod: "HD", index: 1, beatmapId: 100 },
      ],
    });
    expect(snapshot.slots.map((slot) => slot.key)).toEqual(["100", "100#2"]);
  });

  it("lists the default six buckets", () => {
    const snapshot = snapshotOf({ name: "Empty", slots: [] });
    expect(snapshot.buckets.map((bucket) => bucket.code)).toEqual([
      "NM",
      "HD",
      "HR",
      "DT",
      "FM",
      "TB",
    ]);
  });

  it("passes canonicalJson without throwing", () => {
    const snapshot = snapshotOf({
      name: "Pack",
      description: "desc",
      slots: [{ mod: "NM", index: 1, beatmapId: 5 }],
    });
    expect(() => canonicalJson(snapshot)).not.toThrow();
  });

  it("diffValue reports a move, not a remove/add pair, for a slot swap", () => {
    const a = snapshotOf({
      name: "Pack",
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "NM", index: 2, beatmapId: 2 },
      ],
    });
    const b = snapshotOf({
      name: "Pack",
      slots: [
        { mod: "NM", index: 1, beatmapId: 2 },
        { mod: "NM", index: 2, beatmapId: 1 },
      ],
    });
    const changes = diffValue(a, b, PACK_CODEC);
    expect(changes.some((change) => change.op === "move")).toBe(true);
    expect(changes.some((change) => change.op === "add" || change.op === "remove")).toBe(false);
  });

  it("mergeValue of two editors adding different maps cleanly combines them", () => {
    const base = snapshotOf({ name: "Pack", slots: [{ mod: "NM", index: 1, beatmapId: 1 }] });
    const ours = snapshotOf({
      name: "Pack",
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "HD", index: 1, beatmapId: 2 },
      ],
    });
    const theirs = snapshotOf({
      name: "Pack",
      slots: [
        { mod: "NM", index: 1, beatmapId: 1 },
        { mod: "HR", index: 1, beatmapId: 3 },
      ],
    });
    const merged = mergeValue(base, ours, theirs, PACK_CODEC);
    expect(merged.clean).toBe(true);
    expect(merged.value.slots.map((slot) => slot.beatmapId).sort()).toEqual([1, 2, 3]);
  });
});
