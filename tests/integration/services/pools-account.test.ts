/**
 * @file tests/integration/services/pools-account.test.ts
 * @desc ensurePoolsAccount: one system users record under its fixed id, created once (first calls
 *       racing included), with no osu! id and no linked account, that public lists show as
 *       "haruhime pools" with the site icon.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { POOLS_ACCOUNT } from "@/constants/pools";
import { getDb } from "@/lib/db";
import { ensurePoolsAccount } from "@/services/pools-account";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("ensurePoolsAccount", () => {
  it("creates the system account once, under its fixed id", async () => {
    const created = new Date("2026-09-24T10:00:00.000Z");
    expect(await ensurePoolsAccount(created)).toBe(POOLS_ACCOUNT.id);
    expect(await ensurePoolsAccount(new Date("2026-09-25T10:00:00.000Z"))).toBe(POOLS_ACCOUNT.id);
    expect(await getDb().collection("user").find({}).toArray()).toEqual([
      {
        _id: new ObjectId(POOLS_ACCOUNT.id),
        email: "pools@packs.invalid",
        emailVerified: false,
        system: true,
        name: "haruhime pools",
        username: "haruhime pools",
        image: "https://packs.haruhime.moe/brand/packs-icon.svg",
        avatarUrl: "https://packs.haruhime.moe/brand/packs-icon.svg",
        createdAt: created,
        updatedAt: created,
      },
    ]);
  });

  it("makes one account when first calls race", async () => {
    await Promise.all([ensurePoolsAccount(), ensurePoolsAccount(), ensurePoolsAccount()]);
    expect(await getDb().collection("user").countDocuments({})).toBe(1);
  });

  it("has no osu! id and no linked account", async () => {
    await ensurePoolsAccount();
    const user = await getDb()
      .collection("user")
      .findOne({ _id: new ObjectId(POOLS_ACCOUNT.id) });
    expect(user).not.toHaveProperty("osuId");
    expect(await getDb().collection("account").countDocuments({})).toBe(0);
    expect(POOLS_ACCOUNT.email).not.toMatch(/@osu\.local$/);
  });
});
