/**
 * @file tests/integration/app/api/v1/packs-read.test.ts
 * @desc GET /api/v1/packs (public, paged), /api/v1/packs/{slug} (visibility, hidden, never
 *       admin, archive details on archive packs), and /api/v1/me/packs (every own pack, paged).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { ObjectId } from "mongodb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as MY_PACKS } from "@/app/api/v1/me/packs/route";
import { GET as ONE } from "@/app/api/v1/packs/[slug]/route";
import { GET as LIST } from "@/app/api/v1/packs/route";
import { API_PAGE_SIZE, UNKNOWN_OWNER_NAME } from "@/constants/api";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import { apiPackPageResponseSchema, apiPackResponseSchema } from "@/schemas/api";
import type { PackInput } from "@/schemas/saved-pack";
import { ensureArchiveAccount } from "@/services/archive";
import { setPackHidden } from "@/services/moderation";
import { createPack } from "@/services/packs";
import { bearer, createTestApiKey, freezeTime } from "../../../../helpers/api-key";
import { createTestUser } from "../../../../helpers/auth";
import { setupTestDb } from "../../../../helpers/db";
import { apiRequest, noContext, slugContext } from "../../../../helpers/requests";

vi.stubEnv("ADMIN_OSU_IDS", "12231334");
setupTestDb();
beforeEach(() => freezeTime());
afterEach(() => vi.useRealTimers());

const INPUT: PackInput = {
  name: "SPC Finals",
  slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
  visibility: "public",
};
const adminId = () => new ObjectId().toHexString();

const list = (key: string, query = "") =>
  LIST(apiRequest(`/api/v1/packs${query}`, { headers: bearer(key) }), noContext);
const one = (key: string, slug: string) =>
  ONE(apiRequest(`/api/v1/packs/${slug}`, { headers: bearer(key) }), slugContext(slug));
const mine = (key: string, query = "") =>
  MY_PACKS(apiRequest(`/api/v1/me/packs${query}`, { headers: bearer(key) }), noContext);

describe("GET /api/v1/packs", () => {
  it("lists visible public packs only, most recently updated first, as full pack objects", async () => {
    const host = await createTestUser({ username: "host" });
    const reader = await createTestUser();
    const key = await createTestApiKey(reader.id);
    await createPack(host.id, { ...INPUT, name: "Older" });
    await createPack(host.id, { ...INPUT, name: "Unlisted", visibility: "unlisted" });
    await createPack(host.id, { ...INPUT, name: "Private", visibility: "private" });
    const hidden = await createPack(host.id, { ...INPUT, name: "Hidden" });
    await setPackHidden(hidden.slug, adminId(), true);
    await createPack(host.id, { ...INPUT, name: "Newer" });

    const response = await list(key);
    expect(response.status).toBe(200);
    const body = apiPackPageResponseSchema.parse(await response.json());
    expect(body.packs.map((pack) => pack.name)).toEqual(["Newer", "Older"]);
    expect(body).toMatchObject({ page: 1, pageCount: 1, total: 2 });
    expect(body.packs[0]).toMatchObject({
      ownerName: "host",
      packKey: encodePackKey({ name: "Newer", slots: INPUT.slots }),
      slots: INPUT.slots,
      visibility: "public",
    });
  });

  it(`pages ${API_PAGE_SIZE} at a time`, async () => {
    const host = await createTestUser();
    const key = await createTestApiKey(host.id);
    await getPackModel().insertMany(
      Array.from({ length: API_PAGE_SIZE + 1 }, (_, i) => ({
        ...INPUT,
        slug: `pub${String(i).padStart(7, "0")}`,
        ownerId: host.id,
      })),
    );
    const first = apiPackPageResponseSchema.parse(await (await list(key)).json());
    const second = apiPackPageResponseSchema.parse(await (await list(key, "?page=2")).json());
    expect(first.packs).toHaveLength(API_PAGE_SIZE);
    expect(second.packs).toHaveLength(1);
    expect(second).toMatchObject({ page: 2, pageCount: 2, total: API_PAGE_SIZE + 1 });
  });

  it("keeps packs whose owner has no username or no record, so the page matches total", async () => {
    const nameless = await createTestUser();
    const reader = await createTestUser();
    const key = await createTestApiKey(reader.id);
    await createPack(nameless.id, { ...INPUT, name: "Nameless" });
    await getDb()
      .collection("user")
      .updateOne({ _id: new ObjectId(nameless.id) }, { $unset: { username: "" } });
    await getPackModel().create({
      ...INPUT,
      name: "Orphan",
      slug: "orphan0000",
      ownerId: adminId(),
    });

    const response = await list(key);
    expect(response.status).toBe(200);
    const body = apiPackPageResponseSchema.parse(await response.json());
    expect(body.total).toBe(2);
    expect(body.packs.map((pack) => [pack.name, pack.ownerName]).sort()).toEqual([
      ["Nameless", UNKNOWN_OWNER_NAME],
      ["Orphan", UNKNOWN_OWNER_NAME],
    ]);
  });

  it("answers an empty page past the end", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const response = await list(key, "?page=9");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ packs: [], page: 9, pageCount: 1, total: 0 });
  });

  it.each([
    "?page=0",
    "?page=-1",
    "?page=abc",
    "?page=1.5",
    "?page=",
    "?page=1e3",
    "?page=1000000",
  ])("refuses %s with 400", async (query) => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const response = await list(key, query);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "bad_request", message: "Use a page number from 1 to 999999." },
    });
  });
});

describe("GET /api/v1/packs/{slug}", () => {
  it("shows public and unlisted packs to any key", async () => {
    const host = await createTestUser({ username: "host" });
    const reader = await createTestUser();
    const key = await createTestApiKey(reader.id);
    for (const visibility of ["public", "unlisted"] as const) {
      const { slug } = await createPack(host.id, { ...INPUT, visibility });
      const response = await one(key, slug);
      expect(response.status).toBe(200);
      expect(apiPackResponseSchema.parse(await response.json()).pack).toMatchObject({
        slug,
        visibility,
        ownerName: "host",
      });
    }
  });

  it("shows a private pack only to its owner", async () => {
    const host = await createTestUser({ username: "host" });
    const other = await createTestUser();
    const { slug } = await createPack(host.id, { ...INPUT, visibility: "private" });
    const notFound = await one(await createTestApiKey(other.id), slug);
    expect(notFound.status).toBe(404);
    expect(await notFound.json()).toEqual({
      error: { code: "not_found", message: "Pack not found." },
    });
    const own = await one(await createTestApiKey(host.id), slug);
    expect(apiPackResponseSchema.parse(await own.json()).pack.ownerName).toBe("host");
  });

  it("shows a hidden pack to its owner with hiddenAt, and to nobody else, admins included", async () => {
    const host = await createTestUser();
    const admin = await createTestUser({ osuId: 12231334 });
    const { slug } = await createPack(host.id, INPUT);
    await setPackHidden(slug, admin.id, true);
    expect((await one(await createTestApiKey(admin.id), slug)).status).toBe(404);
    const own = apiPackResponseSchema.parse(
      await (await one(await createTestApiKey(host.id), slug)).json(),
    );
    expect(own.pack.hiddenAt).toEqual(expect.any(String));
  });

  it("answers 404 to a non-owner for a hidden unlisted pack", async () => {
    const host = await createTestUser();
    const reader = await createTestUser();
    const { slug } = await createPack(host.id, { ...INPUT, visibility: "unlisted" });
    await setPackHidden(slug, adminId(), true);
    expect((await one(await createTestApiKey(reader.id), slug)).status).toBe(404);
    expect((await one(await createTestApiKey(host.id), slug)).status).toBe(200);
  });

  it("falls back to a placeholder owner name when the owner has no username", async () => {
    const host = await createTestUser();
    const reader = await createTestUser();
    const { slug } = await createPack(host.id, INPUT);
    await getDb()
      .collection("user")
      .updateOne({ _id: new ObjectId(host.id) }, { $unset: { username: "" } });
    const response = await one(await createTestApiKey(reader.id), slug);
    expect(response.status).toBe(200);
    expect(apiPackResponseSchema.parse(await response.json()).pack.ownerName).toBe(
      UNKNOWN_OWNER_NAME,
    );
  });

  it("shows an archive pack's archive details, and leaves a corrupt one out", async () => {
    const reader = await createTestUser();
    const key = await createTestApiKey(reader.id);
    const archiveId = await ensureArchiveAccount();
    const { slug } = await createPack(archiveId, INPUT, { unlimited: true });
    const importedAt = new Date("2026-09-24T12:00:00.000Z");
    const archive = {
      tournament: "osu! World Cup 2023",
      round: "Grand Finals",
      year: 2023,
      badged: null,
      fingerprint: "b".repeat(64),
      sources: [
        { kind: "otdb", id: "657", url: "https://otdb.sheppsu.me/mappool/657", importedAt },
      ],
    };
    await getPackModel().collection.updateOne({ slug }, { $set: { archive } });
    const pack = apiPackResponseSchema.parse(await (await one(key, slug)).json()).pack;
    expect(pack).toMatchObject({
      ownerName: "haruhime archive",
      archive: {
        ...archive,
        sources: [{ ...archive.sources[0], importedAt: importedAt.toISOString() }],
      },
    });

    await getPackModel().collection.updateOne(
      { slug },
      { $set: { "archive.sources.0.url": "javascript:alert(1)" } },
    );
    const corrupt = apiPackResponseSchema.parse(await (await one(key, slug)).json()).pack;
    expect(corrupt).not.toHaveProperty("archive");
    expect(corrupt.slug).toBe(slug);
  });

  it("answers 404 to a malformed or unknown slug", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    expect((await one(key, "nope")).status).toBe(404);
    expect((await one(key, "zzzzzzzzzz")).status).toBe(404);
  });
});

describe("GET /api/v1/me/packs", () => {
  it("lists every own pack, any visibility, and nobody else's", async () => {
    const me = await createTestUser({ username: "me" });
    const other = await createTestUser();
    await createPack(me.id, { ...INPUT, name: "Public" });
    await createPack(me.id, { ...INPUT, name: "Private", visibility: "private" });
    const hidden = await createPack(me.id, { ...INPUT, name: "Hidden" });
    await setPackHidden(hidden.slug, adminId(), true);
    await createPack(other.id, { ...INPUT, name: "Theirs" });

    const response = await mine(await createTestApiKey(me.id));
    const body = apiPackPageResponseSchema.parse(await response.json());
    expect(body.packs.map((pack) => pack.name).sort()).toEqual(["Hidden", "Private", "Public"]);
    expect(body.packs.every((pack) => pack.ownerName === "me")).toBe(true);
    expect(body.packs.find((pack) => pack.name === "Hidden")?.hiddenAt).toEqual(expect.any(String));
    expect(body).toMatchObject({ page: 1, pageCount: 1, total: 3 });
  });

  it(`pages ${API_PAGE_SIZE} at a time in the page envelope`, async () => {
    const me = await createTestUser();
    const key = await createTestApiKey(me.id);
    await getPackModel().insertMany(
      Array.from({ length: 55 }, (_, i) => ({
        ...INPUT,
        visibility: "private",
        slug: `own${String(i).padStart(7, "0")}`,
        ownerId: me.id,
      })),
    );
    const first = apiPackPageResponseSchema.parse(await (await mine(key)).json());
    const second = apiPackPageResponseSchema.parse(await (await mine(key, "?page=2")).json());
    expect(first).toMatchObject({ page: 1, pageCount: 2, total: 55 });
    expect(first.packs).toHaveLength(API_PAGE_SIZE);
    expect(second).toMatchObject({ page: 2, pageCount: 2, total: 55 });
    expect(second.packs).toHaveLength(5);
    const slugs = [...first.packs, ...second.packs].map((pack) => pack.slug);
    expect(new Set(slugs).size).toBe(55);
  });

  it("refuses a bad page with 400", async () => {
    const me = await createTestUser();
    const response = await mine(await createTestApiKey(me.id), "?page=0");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "bad_request", message: "Use a page number from 1 to 999999." },
    });
  });
});
