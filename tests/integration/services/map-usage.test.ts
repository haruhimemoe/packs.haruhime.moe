/**
 * @file tests/integration/services/map-usage.test.ts
 * @desc Map usage in the database: a full rebuild counts public archive packs that aren't hidden
 *       (never community packs), orders entries newest year first and writes only what changed;
 *       a rebuild for some maps leaves the rest alone; a rebuild that wrote stale entries because
 *       another one saw a newer hide first goes round again; hiding, unhiding and deleting an archive
 *       pack (as an admin), and editing or deleting it as its owner, rebuild its maps; a
 *       community pack's changes never touch map usage.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { Collection, ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { MAP_USAGE_COLLECTION } from "@/constants/map-usage";
import { getDb } from "@/lib/db";
import type { PackInput } from "@/schemas/saved-pack";
import { applyArchivePlan, ensureArchiveAccount, listArchivePacks } from "@/services/archive";
import { getMapUsage, rebuildMapUsage } from "@/services/map-usage";
import { adminDeletePack, setPackHidden } from "@/services/moderation";
import { createPack, deletePack, updatePack } from "@/services/packs";
import { planArchiveImport } from "@/utils/archive-import";
import { normalizePool } from "@/utils/archive-pools";
import { otdbSource } from "@/utils/otdb";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const NOW = new Date("2026-09-24T12:00:00.000Z");
const LATER = new Date("2026-09-25T12:00:00.000Z");

/** Imports one otdb pool as an archive pack (slug: its id, padded) without building usage. */
const archivePack = async (id: number, name: string, slots: [string, number][]) => {
  const normalized = normalizePool(
    {
      source: otdbSource(id),
      name,
      slots: slots.map(([label, beatmapId]) => ({ label, beatmapId })),
    },
    new Map(),
    NOW,
  );
  if (!normalized.ok) throw new Error(normalized.skipped.reason);
  const ownerId = await ensureArchiveAccount(NOW);
  const slug = String(id).padStart(10, "a");
  const plan = planArchiveImport([normalized.pool], [], await listArchivePacks());
  await applyArchivePlan(plan, { ownerId, now: NOW, makeSlug: () => slug });
  return { slug, ownerId, fingerprint: normalized.pool.fingerprint };
};

const usageDocs = () =>
  getDb()
    .collection<{ _id: number; updatedAt: Date }>(MAP_USAGE_COLLECTION)
    .find({})
    .sort({ _id: 1 })
    .toArray();

const usedIds = async () => (await usageDocs()).map((doc) => doc._id);

const slugsFor = async (beatmapId: number) =>
  (await getMapUsage([beatmapId]))[0]?.entries.map((entry) => entry.slug);

const communityInput = (beatmapId: number): PackInput => ({
  name: "Community pack",
  slots: [{ mod: "NM", index: 1, beatmapId }],
  visibility: "public",
});

const adminId = () => new ObjectId().toHexString();

describe("rebuildMapUsage", () => {
  it("builds usage from public archive packs only, newest year first, counting pools", async () => {
    const spring = await archivePack(1, "Spring Cup 2023 Finals", [
      ["NM1", 75],
      ["HD1", 76],
    ]);
    const autumn = await archivePack(2, "Autumn Cup 2025 Semifinals", [
      ["NM1", 75],
      ["DT1", 77],
      ["TB", 75],
    ]);
    const host = await createTestUser();
    await createPack(host.id, communityInput(75));
    await createPack(host.id, communityInput(90));

    expect(await rebuildMapUsage(undefined, NOW)).toEqual({ beatmaps: 3, written: 3, removed: 0 });
    expect(await usedIds()).toEqual([75, 76, 77]);
    const [used, unused] = await getMapUsage([75, 90]);
    const autumnEntry = {
      slug: autumn.slug,
      tournament: "Autumn Cup 2025",
      round: "Semifinals",
      year: 2025,
      badged: null,
      fingerprint: autumn.fingerprint,
    };
    expect(used).toEqual({
      beatmapId: 75,
      count: 2,
      entries: [
        { ...autumnEntry, slot: "NM1", mods: "NM" },
        { ...autumnEntry, slot: "TB1", mods: "TB" },
        {
          slug: spring.slug,
          tournament: "Spring Cup 2023",
          round: "Finals",
          year: 2023,
          badged: null,
          slot: "NM1",
          mods: "NM",
          fingerprint: spring.fingerprint,
        },
      ],
    });
    expect(unused).toEqual({ beatmapId: 90, count: 0, entries: [] });
  });

  it("writes nothing when nothing changed", async () => {
    await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    await rebuildMapUsage(undefined, NOW);
    expect(await rebuildMapUsage(undefined, LATER)).toEqual({
      beatmaps: 1,
      written: 0,
      removed: 0,
    });
    expect((await usageDocs())[0]?.updatedAt).toEqual(NOW);
  });

  it("leaves out unlisted archive packs and removes maps nothing uses any more", async () => {
    const { slug } = await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    await getDb()
      .collection(MAP_USAGE_COLLECTION)
      .insertOne({ _id: 999 as never, entries: [] });
    await rebuildMapUsage(undefined, NOW);
    expect(await usedIds()).toEqual([75]);
    await getDb()
      .collection("packs")
      .updateOne({ slug }, { $set: { visibility: "unlisted" } });
    expect(await rebuildMapUsage(undefined, LATER)).toEqual({
      beatmaps: 0,
      written: 0,
      removed: 1,
    });
    expect(await usedIds()).toEqual([]);
  });

  it("rebuilds only the maps asked for", async () => {
    await archivePack(1, "Spring Cup 2023 Finals", [
      ["NM1", 75],
      ["HD1", 76],
    ]);
    expect(await rebuildMapUsage([76, 76, 12], NOW)).toEqual({
      beatmaps: 1,
      written: 1,
      removed: 0,
    });
    expect(await usedIds()).toEqual([76]);
    expect(await rebuildMapUsage([], NOW)).toEqual({ beatmaps: 0, written: 0, removed: 0 });
  });

  it("drops a stored entry that doesn't parse by writing the map again", async () => {
    await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    await getDb()
      .collection(MAP_USAGE_COLLECTION)
      .insertOne({ _id: 75 as never, entries: [{ slug: 5 }], updatedAt: NOW });
    expect(await getMapUsage([75])).toEqual([{ beatmapId: 75, count: 0, entries: [] }]);
    expect(await rebuildMapUsage([75], LATER)).toMatchObject({ written: 1 });
    expect((await getMapUsage([75]))[0]?.count).toBe(1);
  });
});

describe("rebuilds that race", () => {
  const hideNow = (slug: string) =>
    getDb()
      .collection("packs")
      .updateOne({ slug }, { $set: { hiddenAt: new Date(), hiddenBy: new ObjectId() } });

  it("never leave a hidden pack in usage when one writes after another saw a newer hide", async () => {
    const a = await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    const b = await archivePack(2, "Autumn Cup 2025 Finals", [["NM1", 75]]);
    await rebuildMapUsage(undefined, NOW);
    // An admin hides A: A's refresh reads the packs while B is still shown, so it plans [B]...
    await hideNow(a.slug);
    let raced = false;
    await rebuildMapUsage([75], LATER, {
      beforeWrite: async () => {
        if (raced) return;
        raced = true;
        // ...then B is hidden too, and B's refresh runs to the end (removing the map) first.
        await hideNow(b.slug);
        await rebuildMapUsage([75], LATER);
      },
    });
    expect(raced).toBe(true);
    expect(await getMapUsage([75])).toEqual([{ beatmapId: 75, count: 0, entries: [] }]);
    expect(await usedIds()).toEqual([]);
  });

  it("read the packs again only once when nothing changed meanwhile", async () => {
    await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    const find = vi.spyOn(Collection.prototype, "find");
    try {
      await rebuildMapUsage([75], NOW);
      const packReads = find.mock.contexts.filter(
        (context) => (context as Collection).collectionName === "packs",
      );
      expect(packReads).toHaveLength(2);
    } finally {
      find.mockRestore();
    }
  });
});

describe("archive pack changes rebuild their maps", () => {
  it("hiding takes a pack out and unhiding puts it back", async () => {
    const spring = await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    // Other maps too: the same maps and mods would be the same pool.
    const autumn = await archivePack(2, "Autumn Cup 2025 Finals", [
      ["NM1", 75],
      ["HD1", 78],
    ]);
    await rebuildMapUsage(undefined, NOW);
    expect(await slugsFor(75)).toEqual([autumn.slug, spring.slug]);
    await setPackHidden(spring.slug, adminId(), true);
    expect(await slugsFor(75)).toEqual([autumn.slug]);
    await setPackHidden(autumn.slug, adminId(), true);
    expect(await usedIds()).toEqual([]);
    await setPackHidden(spring.slug, adminId(), false);
    expect(await slugsFor(75)).toEqual([spring.slug]);
  });

  it("an admin's delete takes a pack out", async () => {
    const spring = await archivePack(1, "Spring Cup 2023 Finals", [
      ["NM1", 75],
      ["HD1", 76],
    ]);
    await rebuildMapUsage(undefined, NOW);
    expect(await adminDeletePack(spring.slug)).toBe(true);
    expect(await usedIds()).toEqual([]);
  });

  it("an edit by its owner rebuilds the old and new maps", async () => {
    const spring = await archivePack(1, "Spring Cup 2023 Finals", [
      ["NM1", 75],
      ["HD1", 76],
    ]);
    await rebuildMapUsage(undefined, NOW);
    await updatePack(spring.slug, spring.ownerId, {
      name: "Spring Cup 2023 Finals",
      slots: [
        { mod: "NM", index: 1, beatmapId: 75 },
        { mod: "HD", index: 1, beatmapId: 80 },
      ],
      visibility: "public",
    });
    expect(await usedIds()).toEqual([75, 80]);
    expect((await getMapUsage([80]))[0]?.entries[0]).toMatchObject({ slot: "HD1", mods: "HD" });
  });

  it("a delete by its owner takes it out", async () => {
    const spring = await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    await rebuildMapUsage(undefined, NOW);
    expect(await deletePack(spring.slug, spring.ownerId)).toBe(true);
    expect(await usedIds()).toEqual([]);
  });

  it("a community pack's changes never touch map usage", async () => {
    const host = await createTestUser();
    const pack = await createPack(host.id, communityInput(75));
    // A stale document a rebuild of map 75 or 76 would remove.
    for (const id of [75, 76]) {
      await getDb()
        .collection(MAP_USAGE_COLLECTION)
        .insertOne({ _id: id as never, entries: [], updatedAt: NOW });
    }
    await setPackHidden(pack.slug, adminId(), true);
    await setPackHidden(pack.slug, adminId(), false);
    await updatePack(pack.slug, host.id, communityInput(76));
    await deletePack(pack.slug, host.id);
    expect(await usedIds()).toEqual([75, 76]);
  });

  it("hiding a pack twice rebuilds once", async () => {
    const spring = await archivePack(1, "Spring Cup 2023 Finals", [["NM1", 75]]);
    await rebuildMapUsage(undefined, NOW);
    await setPackHidden(spring.slug, adminId(), true);
    await getDb()
      .collection(MAP_USAGE_COLLECTION)
      .insertOne({ _id: 75 as never, entries: [], updatedAt: NOW });
    await setPackHidden(spring.slug, adminId(), true);
    expect(await usedIds()).toEqual([75]);
  });
});
