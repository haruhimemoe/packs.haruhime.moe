/**
 * @file tests/integration/services/pools-sync.test.ts
 * @desc syncPoolsPack: a create that lost the race on the origin index is retried once as an
 *       update (or found unchanged); any other failure is rethrown; a tombstoned pool answers null
 *       and writes nothing, and so does a pool a moderator deletes while its sync runs (the pack
 *       it just created or found stays gone). tombstoneOrigin keeps the first date.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { revalidatePath } from "next/cache";
import { describe, expect, it, vi } from "vitest";
import { DELETED_ORIGINS_COLLECTION, POOLS_ACCOUNT } from "@/constants/pools";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import type { PackInput } from "@/schemas/saved-pack";
import { adminDeletePack } from "@/services/moderation";
import { createPack } from "@/services/packs";
import { ensurePoolsAccount } from "@/services/pools-account";
import { syncPoolsPack, tombstoneOrigin } from "@/services/pools-sync";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const REF = "otdb-58";
const input = (overrides: Partial<PackInput> = {}): PackInput => ({
  name: "Ricma 2 Quarterfinals",
  slots: [{ mod: "NM", index: 1, beatmapId: 101 }],
  visibility: "public",
  ...overrides,
});

/** The pack another sync of REF created after this one looked and found nothing. */
const createdMeanwhile = async (overrides: Partial<PackInput> = {}) => {
  await ensurePoolsAccount();
  return createPack(POOLS_ACCOUNT.id, input(overrides), {
    unlimited: true,
    origin: { kind: "pools", id: REF },
  });
};
const staleLookup = async () => null;
const paths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path);

describe("syncPoolsPack", () => {
  it("updates the pack that won a race on the origin index", async () => {
    const winner = await createdMeanwhile({ name: "Old name" });
    expect(await syncPoolsPack(REF, input(), { lookup: staleLookup })).toEqual({
      slug: winner.slug,
      state: "updated",
      listed: true,
    });
    expect(await getPackModel().countDocuments({})).toBe(1);
    expect((await getPackModel().findOne({ slug: winner.slug }).lean())?.name).toBe(
      "Ricma 2 Quarterfinals",
    );
  });

  it("answers unchanged when the pack that won the race holds the same input", async () => {
    const winner = await createdMeanwhile();
    expect(await syncPoolsPack(REF, input(), { lookup: staleLookup })).toEqual({
      slug: winner.slug,
      state: "unchanged",
      listed: true,
    });
  });

  it("rethrows a failure that isn't a lost race", async () => {
    const failing = async () => {
      throw new Error("database gone");
    };
    await expect(syncPoolsPack(REF, input(), { lookup: failing })).rejects.toThrow("database gone");
  });

  it("answers null for a tombstoned pool and writes nothing", async () => {
    await tombstoneOrigin(REF);
    expect(await syncPoolsPack(REF, input())).toBeNull();
    expect(await getPackModel().countDocuments({})).toBe(0);
    expect(await getDb().collection("user").countDocuments({})).toBe(0);
  });
});

describe("syncPoolsPack and a moderator's delete during the sync", () => {
  it("deletes the pack it just created when the pool was tombstoned after its first check", async () => {
    const tombstonedMeanwhile = async (ref: string) => {
      await tombstoneOrigin(ref);
      return null;
    };
    vi.mocked(revalidatePath).mockClear();
    expect(await syncPoolsPack(REF, input(), { lookup: tombstonedMeanwhile })).toBeNull();
    expect(await getPackModel().countDocuments({})).toBe(0);
    // It was public for a moment: the lists are marked stale again.
    expect(paths()).toContain("/packs/index.json");
  });

  it("never brings back a pack a moderator deletes between the check and the lookup", async () => {
    const pack = await createdMeanwhile();
    const deletedMeanwhile = async () => {
      expect(await adminDeletePack(pack.slug)).toBe(true);
      return null;
    };
    expect(await syncPoolsPack(REF, input(), { lookup: deletedMeanwhile })).toBeNull();
    expect(await getPackModel().countDocuments({})).toBe(0);
  });

  it("answers null when the pack it found is deleted before its update", async () => {
    const pack = await createdMeanwhile({ name: "Old name" });
    const foundThenDeleted = async () => {
      const found = await getPackModel().findOne({ slug: pack.slug }).lean();
      expect(await adminDeletePack(pack.slug)).toBe(true);
      return found;
    };
    expect(await syncPoolsPack(REF, input(), { lookup: foundThenDeleted })).toBeNull();
    expect(await getPackModel().countDocuments({})).toBe(0);
  });
});

describe("tombstoneOrigin", () => {
  it("keeps the first deletion's date", async () => {
    const first = new Date("2026-09-24T10:00:00.000Z");
    await tombstoneOrigin(REF, first);
    await tombstoneOrigin(REF, new Date("2026-09-25T10:00:00.000Z"));
    expect(await getDb().collection(DELETED_ORIGINS_COLLECTION).find({}).toArray()).toEqual([
      { _id: REF, deletedAt: first },
    ]);
  });
});
