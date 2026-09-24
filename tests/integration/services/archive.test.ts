/**
 * @file tests/integration/services/archive.test.ts
 * @desc ensureArchiveAccount: one system users record, created once, with no osu! id and no
 *       linked account, that public lists show as "haruhime archive" with the site icon.
 *       applyArchivePlan: a slug collision retries, a pool another import stored meanwhile gets
 *       the sources instead of a second pack, a source is never added twice, and seeded stats
 *       are always stored incomplete, so the stats job replaces the source's ratings.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { ARCHIVE_ACCOUNT } from "@/constants/archive";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import { applyArchivePlan, ensureArchiveAccount, listArchivePacks } from "@/services/archive";
import { planArchiveImport } from "@/utils/archive-import";
import { type ArchiveSourceRef, type NormalizedPool, normalizePool } from "@/utils/archive-pools";
import { otdbSource } from "@/utils/otdb";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("ensureArchiveAccount", () => {
  it("creates the system account once and returns the same id after that", async () => {
    const created = new Date("2026-09-24T10:00:00.000Z");
    const id = await ensureArchiveAccount(created);
    expect(await ensureArchiveAccount(new Date("2026-09-25T10:00:00.000Z"))).toBe(id);
    const users = await getDb().collection("user").find({}).toArray();
    expect(users).toHaveLength(1);
    expect(users[0]).toEqual({
      _id: new ObjectId(id),
      email: ARCHIVE_ACCOUNT.email,
      emailVerified: false,
      system: true,
      name: "haruhime archive",
      username: "haruhime archive",
      image: "https://packs.haruhime.moe/brand/packs-icon.svg",
      avatarUrl: "https://packs.haruhime.moe/brand/packs-icon.svg",
      createdAt: created,
      updatedAt: created,
    });
  });

  it("has no osu! id and no linked account", async () => {
    const id = await ensureArchiveAccount();
    const user = await getDb()
      .collection("user")
      .findOne({ _id: new ObjectId(id) });
    expect(user).not.toHaveProperty("osuId");
    expect(await getDb().collection("account").countDocuments({})).toBe(0);
    expect(ARCHIVE_ACCOUNT.email).not.toMatch(/@osu\.local$/);
  });
});

const NOW = new Date("2026-09-24T12:00:00.000Z");

const pool = (source: ArchiveSourceRef, name: string, ...maps: number[]): NormalizedPool => {
  const result = normalizePool(
    { source, name, slots: maps.map((beatmapId, i) => ({ label: `NM${i + 1}`, beatmapId })) },
    new Map(),
    NOW,
  );
  if (!result.ok) throw new Error(result.skipped.reason);
  return result.pool;
};

describe("applyArchivePlan", () => {
  it("tries another slug when one is taken", async () => {
    const ownerId = await ensureArchiveAccount(NOW);
    const slugs = ["aaaaaaaaaa", "aaaaaaaaaa", "bbbbbbbbbb"];
    const makeSlug = () => slugs.shift() ?? "zzzzzzzzzz";
    const plan = planArchiveImport(
      [pool(otdbSource(1), "A Cup Finals", 1), pool(otdbSource(2), "B Cup Finals", 2)],
      [],
      [],
    );
    expect(await applyArchivePlan(plan, { ownerId, now: NOW, makeSlug })).toEqual({
      created: 2,
      updated: 0,
      unlisted: 0,
    });
    const stored = await getPackModel().find({}).sort({ _id: 1 }).lean();
    expect(stored.map((pack) => pack.slug)).toEqual(["aaaaaaaaaa", "bbbbbbbbbb"]);
    expect(stored[0]?.stats).toMatchObject({ complete: false, attempts: 1, retryAt: NOW });
  });

  it("adds the sources to a pack another import stored meanwhile, never twice", async () => {
    const ownerId = await ensureArchiveAccount(NOW);
    const first = pool(otdbSource(1), "A Cup Finals", 1, 2);
    const copy = pool({ kind: "otr", id: "7", url: "https://otr.example/7" }, "A Cup GF", 2, 1);
    // Both imports planned against an empty archive; the second finds the pack already there.
    const racing = planArchiveImport([copy], [], []);
    await applyArchivePlan(planArchiveImport([first], [], []), { ownerId, now: NOW });
    expect(await applyArchivePlan(racing, { ownerId, now: NOW })).toEqual({
      created: 0,
      updated: 1,
      unlisted: 0,
    });
    expect(await applyArchivePlan(racing, { ownerId, now: NOW })).toEqual({
      created: 0,
      updated: 0,
      unlisted: 0,
    });
    const [stored] = await listArchivePacks();
    expect(stored?.sources).toEqual([
      { kind: "otdb", id: "1" },
      { kind: "otr", id: "7" },
    ]);
    expect(await getPackModel().countDocuments({})).toBe(1);
  });

  it("stores seeded stats as incomplete even when the source had every rating", async () => {
    const ownerId = await ensureArchiveAccount(NOW);
    const complete = {
      ...pool(otdbSource(3), "C Cup Finals", 3),
      stats: { ...pool(otdbSource(3), "C Cup Finals", 3).stats, complete: true },
    };
    await applyArchivePlan(planArchiveImport([complete], [], []), { ownerId, now: NOW });
    const stored = await getPackModel().findOne({}).lean();
    // The source's ratings can be older than osu!'s: the stats job replaces them at least once.
    expect(stored?.stats).toMatchObject({ complete: false, attempts: 1, retryAt: NOW });
  });

  it("rethrows other write errors", async () => {
    const plan = planArchiveImport([pool(otdbSource(4), "D Cup Finals", 4)], [], []);
    await expect(
      applyArchivePlan(plan, { ownerId: "not-an-object-id", now: NOW }),
    ).rejects.toThrow();
  });
});
