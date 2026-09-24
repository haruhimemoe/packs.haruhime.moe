/**
 * @file tests/integration/services/archive-account.test.ts
 * @desc ensureArchiveAccount: one system users record, created once, with no osu! id and no
 *       linked account, that public lists show as "haruhime archive" with the site icon.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import { ARCHIVE_ACCOUNT } from "@/constants/archive";
import { getDb } from "@/lib/db";
import { ensureArchiveAccount } from "@/services/archive";
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
