/**
 * @file tests/integration/services/public-packs.test.ts
 * @desc The cached public list and search index: only public, visible packs, newest created
 *       first (an edit doesn't move a pack up), with the host's osu! name; paging; the index shape
 *       (creation date included) and cap; pack stats in compact form on index entries and cards
 *       (left out when a pack has none); archive packs' source links on cards and x, xk, xu in the
 *       index; the pinned row (public, visible, in pin order, the same cards); no database under
 *       CI builds.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { getPackModel } from "@/models/Pack";
import { searchIndexSchema } from "@/schemas/public-pack";
import type { PackInput } from "@/schemas/saved-pack";
import { ensureArchiveAccount } from "@/services/archive";
import { createPack } from "@/services/packs";
import { pinPack, reorderPins } from "@/services/pins";
import { buildSearchIndex, listPinnedPacks, listPublicPacks } from "@/services/public-packs";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

/** Stores stats on a pack the way the stats job would, without moving updatedAt. */
const giveStats = (slug: string, stats: Record<string, unknown>) =>
  getPackModel().updateOne(
    { slug },
    {
      $set: {
        stats: {
          srMin: 5.12,
          srMax: 7.81,
          srAvg: 6.3,
          lenMin: 90,
          lenMax: 258,
          bpmMin: 120,
          bpmMax: 333,
          mods: ["NM", "TB"],
          modes: ["osu"],
          count: 2,
          complete: true,
          computedAt: new Date("2026-09-24T12:00:00Z"),
          ...stats,
        },
      },
    },
    { timestamps: false },
  );

const input = (overrides: Partial<PackInput> = {}): PackInput => ({
  name: "SPC Finals",
  slots: [
    { mod: "NM", index: 1, beatmapId: 129891 },
    { mod: "TB", index: 1, beatmapId: 1872396 },
  ],
  visibility: "public",
  ...overrides,
});

describe("listPublicPacks", () => {
  it("lists public, visible packs newest first with their host", async () => {
    const host = await createTestUser({ username: "Chiyo" });
    await createPack(host.id, input({ name: "Unlisted", visibility: "unlisted" }));
    await createPack(host.id, input({ name: "Private", visibility: "private" }));
    const hidden = await createPack(host.id, input({ name: "Hidden" }));
    await getPackModel().updateOne(
      { slug: hidden.slug },
      { $set: { hiddenAt: new Date(), hiddenBy: new ObjectId() } },
    );
    await createPack(host.id, input({ name: "Older" }));
    await createPack(host.id, input({ name: "Newer", description: "  Quals pool\n\nfor SPC  " }));
    const result = await listPublicPacks(1);
    expect(result).toMatchObject({ page: 1, pageCount: 1, total: 2 });
    expect(result.packs.map((p) => p.name)).toEqual(["Newer", "Older"]);
    expect(result.packs[0]).toMatchObject({
      ownerName: "Chiyo",
      ownerAvatarUrl: null,
      slotCount: 2,
      excerpt: "Quals pool for SPC",
    });
    const newer = await getPackModel().findOne({ name: "Newer" }).lean();
    expect(result.packs[0]?.createdAt).toBe(newer?.createdAt.toISOString());
  });

  it("pages 24 at a time", async () => {
    const host = await createTestUser();
    for (let i = 0; i < 25; i++) await createPack(host.id, input({ name: `Pack ${i}` }));
    const first = await listPublicPacks(1);
    expect(first.packs).toHaveLength(24);
    expect(first.pageCount).toBe(2);
    expect((await listPublicPacks(2)).packs.map((p) => p.name)).toEqual(["Pack 0"]);
  });

  it("orders by creation, so editing an older pack doesn't move it up", async () => {
    const host = await createTestUser();
    const older = await createPack(host.id, input({ name: "Older" }));
    await createPack(host.id, input({ name: "Newer" }));
    await getPackModel().updateOne(
      { slug: older.slug },
      { $set: { updatedAt: new Date("2030-01-01T00:00:00Z") } },
      { timestamps: false },
    );
    expect((await listPublicPacks(1)).packs.map((p) => p.name)).toEqual(["Newer", "Older"]);
    expect((await buildSearchIndex()).packs.map((e) => e.n)).toEqual(["Newer", "Older"]);
  });

  it("is empty without a database query in CI builds", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    try {
      expect(await listPublicPacks(3)).toEqual({ packs: [], page: 3, pageCount: 1, total: 0 });
      expect(await buildSearchIndex()).toEqual({ v: 1, packs: [] });
    } finally {
      vi.stubEnv("SKIP_ENV_VALIDATION", "");
    }
  });
});

describe("public cards", () => {
  it("carry the compact stats when the pack has them", async () => {
    const host = await createTestUser();
    const none = await createPack(host.id, input({ name: "No stats" }));
    const full = await createPack(host.id, input({ name: "Full" }));
    await giveStats(full.slug, {});

    const cards = (await listPublicPacks(1)).packs;

    expect(cards.find((card) => card.slug === full.slug)?.stats).toEqual({
      r: [5.12, 7.81],
      a: 6.3,
      l: [90, 258],
      b: [120, 333],
      m: "NM,TB",
      g: "osu",
      k: true,
    });
    expect(cards.find((card) => card.slug === none.slug)).not.toHaveProperty("stats");
  });
});

/** Makes a pack an archive pack, the way the importer stores it. */
const archive = (slug: string, url = "https://otdb.sheppsu.me/db/mappools/657/") =>
  getPackModel().collection.updateOne(
    { slug },
    {
      $set: {
        archive: {
          tournament: "osu! World Cup 2023",
          round: "Grand Finals",
          year: 2023,
          badged: null,
          fingerprint: "c".repeat(64),
          sources: [{ kind: "otdb", id: "657", url, importedAt: new Date() }],
        },
      },
    },
  );

describe("archive packs on the list and in the index", () => {
  it("link their first source on cards, and carry x, xk and xu in the index", async () => {
    const host = await createTestUser({ username: "host" });
    const archiveId = await ensureArchiveAccount();
    const community = await createPack(host.id, input({ name: "Community Cup" }));
    const archived = await createPack(archiveId, input({ name: "OWC 2023 GF" }), {
      unlimited: true,
    });
    await archive(archived.slug);

    const cards = (await listPublicPacks(1)).packs;
    expect(cards.find((card) => card.slug === archived.slug)).toMatchObject({
      ownerName: "haruhime archive",
      ownerAvatarUrl: "https://packs.haruhime.moe/brand/packs-icon.svg",
      archiveSource: { kind: "otdb", url: "https://otdb.sheppsu.me/db/mappools/657/" },
    });
    expect(cards.find((card) => card.slug === community.slug)).not.toHaveProperty("archiveSource");

    const index = await buildSearchIndex();
    expect(index.packs.find((entry) => entry.s === archived.slug)).toMatchObject({
      x: 1,
      xk: "otdb",
      xu: "https://otdb.sheppsu.me/db/mappools/657/",
    });
    const plain = index.packs.find((entry) => entry.s === community.slug);
    expect(plain).not.toHaveProperty("x");
    expect(plain).not.toHaveProperty("xk");
  });

  it("keep x but drop a source link that isn't https, so the index still parses", async () => {
    const archiveId = await ensureArchiveAccount();
    const archived = await createPack(archiveId, input(), { unlimited: true });
    await archive(archived.slug, "javascript:alert(1)");
    const [card] = (await listPublicPacks(1)).packs;
    expect(card).not.toHaveProperty("archiveSource");
    const [entry] = (await buildSearchIndex()).packs;
    expect(entry).toMatchObject({ x: 1 });
    expect(entry).not.toHaveProperty("xu");
  });
});

describe("listPublicPacks past the end", () => {
  it("skips the page query when the page is past the last one", async () => {
    const host = await createTestUser();
    await createPack(host.id, input());
    const aggregate = vi.spyOn(getPackModel(), "aggregate");
    try {
      expect(await listPublicPacks(5)).toEqual({ packs: [], page: 5, pageCount: 1, total: 1 });
      expect(aggregate).not.toHaveBeenCalled();
    } finally {
      aggregate.mockRestore();
    }
  });
});

describe("buildSearchIndex", () => {
  it("lists public packs, newest first, in the compact shape", async () => {
    const host = await createTestUser({ username: "Chiyo" });
    await createPack(host.id, input({ name: "Unlisted", visibility: "unlisted" }));
    const pack = await createPack(
      host.id,
      input({ name: "Pokémon Cup", description: "Round of 16" }),
    );
    const index = await buildSearchIndex();
    expect(searchIndexSchema.safeParse(index).success).toBe(true);
    expect(index.packs).toEqual([
      {
        s: pack.slug,
        n: "Pokémon Cup",
        o: "Chiyo",
        c: 2,
        d: "Round of 16",
        u: pack.updatedAt,
        t: pack.createdAt,
      },
    ]);
  });

  it("adds each pack's stats in compact form, and leaves them out when it has none", async () => {
    const host = await createTestUser({ username: "Chiyo" });
    const none = await createPack(host.id, input({ name: "No stats" }));
    const partial = await createPack(host.id, input({ name: "Partial" }));
    const full = await createPack(host.id, input({ name: "Full" }));
    await giveStats(full.slug, {});
    await giveStats(partial.slug, {
      srMin: null,
      srMax: null,
      srAvg: null,
      mods: ["NM", "DT"],
      modes: ["osu", "mania"],
      complete: false,
    });

    const index = await buildSearchIndex();

    expect(searchIndexSchema.safeParse(index).success).toBe(true);
    const base = { o: "Chiyo", c: 2, d: "" };
    expect(index.packs).toEqual([
      {
        s: full.slug,
        n: "Full",
        ...base,
        u: full.updatedAt,
        t: full.createdAt,
        r: [5.12, 7.81],
        a: 6.3,
        l: [90, 258],
        b: [120, 333],
        m: "NM,TB",
        g: "osu",
        k: true,
      },
      {
        s: partial.slug,
        n: "Partial",
        ...base,
        u: partial.updatedAt,
        t: partial.createdAt,
        l: [90, 258],
        b: [120, 333],
        m: "NM,DT",
        g: "osu,mania",
        k: false,
      },
      { s: none.slug, n: "No stats", ...base, u: none.updatedAt, t: none.createdAt },
    ]);
  });

  it("stops at the limit", async () => {
    const host = await createTestUser();
    for (let i = 0; i < 3; i++) await createPack(host.id, input({ name: `Pack ${i}` }));
    expect((await buildSearchIndex({ limit: 2 })).packs.map((e) => e.n)).toEqual([
      "Pack 2",
      "Pack 1",
    ]);
  });
});

describe("listPinnedPacks", () => {
  it("lists pinned packs in pin order, as the same cards the list shows", async () => {
    const host = await createTestUser({ username: "Chiyo" });
    const first = await createPack(host.id, input({ name: "First", description: "Quals" }));
    const second = await createPack(host.id, input({ name: "Second" }));
    await createPack(host.id, input({ name: "Not pinned" }));
    await giveStats(first.slug, {});
    await pinPack(first.slug);
    await pinPack(second.slug);
    await reorderPins([second.slug, first.slug]);

    const pinned = await listPinnedPacks();

    expect(pinned.map((card) => card.name)).toEqual(["Second", "First"]);
    const listed = (await listPublicPacks(1)).packs.find((card) => card.slug === first.slug);
    expect(pinned[1]).toEqual(listed);
  });

  it("leaves out a pinned pack that is hidden or not public", async () => {
    const host = await createTestUser();
    const shown = await createPack(host.id, input({ name: "Shown" }));
    const hidden = await createPack(host.id, input({ name: "Hidden" }));
    const unlisted = await createPack(host.id, input({ name: "Unlisted" }));
    await pinPack(shown.slug);
    // Pins the services would have taken away, written straight to the database.
    await getPackModel().collection.updateOne(
      { slug: hidden.slug },
      { $set: { pinnedAt: new Date(), pinOrder: 1, hiddenAt: new Date() } },
    );
    await getPackModel().collection.updateOne(
      { slug: unlisted.slug },
      { $set: { pinnedAt: new Date(), pinOrder: 2, visibility: "unlisted" } },
    );
    expect((await listPinnedPacks()).map((card) => card.name)).toEqual(["Shown"]);
  });

  it("is empty without a database query in CI builds", async () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    try {
      expect(await listPinnedPacks()).toEqual([]);
    } finally {
      vi.stubEnv("SKIP_ENV_VALIDATION", "");
    }
  });
});
