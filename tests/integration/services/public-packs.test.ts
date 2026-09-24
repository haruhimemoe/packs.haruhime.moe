/**
 * @file tests/integration/services/public-packs.test.ts
 * @desc The cached public list and search index: only public, visible packs, newest first, with
 *       the host's osu! name; paging; the index shape and cap; no database under CI builds.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it, vi } from "vitest";
import { getPackModel } from "@/models/Pack";
import { searchIndexSchema } from "@/schemas/public-pack";
import type { PackInput } from "@/schemas/saved-pack";
import { createPack } from "@/services/packs";
import { buildSearchIndex, listPublicPacks } from "@/services/public-packs";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

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
  });

  it("pages 24 at a time", async () => {
    const host = await createTestUser();
    for (let i = 0; i < 25; i++) await createPack(host.id, input({ name: `Pack ${i}` }));
    const first = await listPublicPacks(1);
    expect(first.packs).toHaveLength(24);
    expect(first.pageCount).toBe(2);
    expect((await listPublicPacks(2)).packs.map((p) => p.name)).toEqual(["Pack 0"]);
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
      { s: pack.slug, n: "Pokémon Cup", o: "Chiyo", c: 2, d: "Round of 16", u: pack.updatedAt },
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
