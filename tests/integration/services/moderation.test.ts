/**
 * @file tests/integration/services/moderation.test.ts
 * @desc Admin list (public + unlisted only, hidden filter, literal name filter) and hiding.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";
import type { PackInput } from "@/schemas/saved-pack";
import { listPacksForAdmin, setPackHidden } from "@/services/moderation";
import { createPack } from "@/services/packs";
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
const adminId = () => new ObjectId().toHexString();

describe("listPacksForAdmin", () => {
  it("lists public and unlisted packs, never private ones, with the host", async () => {
    const host = await createTestUser({ username: "host" });
    await createPack(host.id, input({ name: "Private", visibility: "private" }));
    await createPack(host.id, input({ name: "Unlisted", visibility: "unlisted" }));
    await createPack(host.id, input({ name: "Public" }));
    const result = await listPacksForAdmin();
    expect(result).toMatchObject({ page: 1, pageCount: 1, total: 2 });
    expect(result.rows.map((r) => r.name)).toEqual(["Public", "Unlisted"]);
    expect(result.rows[0]).toMatchObject({
      ownerName: "host",
      ownerOsuId: host.osuId,
      visibility: "public",
      slotCount: 2,
      hiddenAt: null,
    });
  });

  it("filters to hidden packs", async () => {
    const host = await createTestUser();
    const hidden = await createPack(host.id, input({ name: "Hidden" }));
    await createPack(host.id, input({ name: "Shown" }));
    await setPackHidden(hidden.slug, adminId(), true);
    const result = await listPacksForAdmin({ hiddenOnly: true });
    expect(result.rows.map((r) => r.name)).toEqual(["Hidden"]);
    expect(result.rows[0]?.hiddenAt).toEqual(expect.any(String));
  });

  it("filters by name, ignoring case, never as a regex", async () => {
    const host = await createTestUser();
    await createPack(host.id, input({ name: "a.b Cup" }));
    await createPack(host.id, input({ name: "axb Cup" }));
    expect((await listPacksForAdmin({ query: "a.b" })).rows.map((r) => r.name)).toEqual([
      "a.b Cup",
    ]);
    expect((await listPacksForAdmin({ query: "CUP" })).total).toBe(2);
  });
});

describe("setPackHidden", () => {
  it("keeps the first hide's date and moderator when hidden again", async () => {
    const host = await createTestUser();
    const { slug } = await createPack(host.id, input());
    const first = await setPackHidden(slug, adminId(), true);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const again = await setPackHidden(slug, adminId(), true);
    expect(again?.hiddenAt).toBe(first?.hiddenAt);
    expect(again).not.toBeNull();
  });

  it("returns null for private, unknown, and malformed slugs", async () => {
    const host = await createTestUser();
    const secret = await createPack(host.id, input({ visibility: "private" }));
    expect(await setPackHidden(secret.slug, adminId(), true)).toBeNull();
    expect(await setPackHidden("zzzzzzzzzz", adminId(), true)).toBeNull();
    expect(await setPackHidden("../etc", adminId(), true)).toBeNull();
  });
});
