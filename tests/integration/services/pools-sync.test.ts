/**
 * @file tests/integration/services/pools-sync.test.ts
 * @desc syncPoolsPack: a create that lost the race on the origin index is retried once as an
 *       update (or found unchanged); any other failure is rethrown; a tombstoned pool answers null
 *       and writes nothing. tombstoneOrigin keeps the first date.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { DELETED_ORIGINS_COLLECTION, POOLS_ACCOUNT } from "@/constants/pools";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import type { PackInput } from "@/schemas/saved-pack";
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
