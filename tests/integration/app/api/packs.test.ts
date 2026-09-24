/**
 * @file tests/integration/app/api/packs.test.ts
 * @desc POST/GET /api/packs through the real handler, real sessions, in-memory Mongo: the
 *       per-account cap (none for admins) and paged lists.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { GET as GET_PACK } from "@/app/api/packs/[slug]/route";
import { GET, POST } from "@/app/api/packs/route";
import { MAX_SAVED_PACKS, OWN_PAGE_SIZE } from "@/constants/pack";
import { getPackModel } from "@/models/Pack";
import type { ApiErrorBody } from "@/schemas/api";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";

vi.stubEnv("ADMIN_OSU_IDS", "12231334");
setupTestDb();

const PACK = {
  name: "SPC Finals",
  slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
};

describe("POST /api/packs", () => {
  it("asks anonymous callers to sign in", async () => {
    const response = await POST(apiRequest("/api/packs", { method: "POST", body: PACK }));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      error: { code: "unauthorized", message: "Sign in with osu! to save packs." },
    });
  });

  it("rejects a forged session cookie", async () => {
    const user = await createTestUser();
    const cookie = user.cookie.replace(/\.[^.]+$/, ".forged");
    expect(cookie).toMatch(/^better-auth\.session_token=[^.]+\.forged$/);
    const response = await POST(apiRequest("/api/packs", { method: "POST", body: PACK, cookie }));
    expect(response.status).toBe(401);
  });

  it("saves a pack for the signed-in user", async () => {
    const user = await createTestUser();
    const response = await POST(
      apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }),
    );
    expect(response.status).toBe(201);
    const { pack } = (await response.json()) as { pack: { slug: string; visibility: string } };
    expect(pack.slug).toMatch(/^[A-Za-z0-9_-]{10}$/);
    expect(pack.visibility).toBe("unlisted");
  });

  it("ignores ownerId and slug sent in the body", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const response = await POST(
      apiRequest("/api/packs", {
        method: "POST",
        cookie: owner.cookie,
        body: { ...PACK, ownerId: other.id, slug: "chosen1234" },
      }),
    );
    const { pack } = (await response.json()) as { pack: { slug: string } };
    expect(pack.slug).not.toBe("chosen1234");
    const mine = await GET(apiRequest("/api/packs", { cookie: owner.cookie }));
    const theirs = await GET(apiRequest("/api/packs", { cookie: other.cookie }));
    expect(((await mine.json()) as { packs: unknown[] }).packs).toHaveLength(1);
    expect(((await theirs.json()) as { packs: unknown[] }).packs).toHaveLength(0);
  });

  it("explains an invalid pack", async () => {
    const user = await createTestUser();
    const response = await POST(
      apiRequest("/api/packs", {
        method: "POST",
        cookie: user.cookie,
        body: { name: "Empty", slots: [] },
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "bad_request", message: "Add at least one map before saving." },
    });
  });

  it("refuses non-JSON bodies", async () => {
    const user = await createTestUser();
    const response = await POST(
      apiRequest("/api/packs", {
        method: "POST",
        cookie: user.cookie,
        body: "name=x",
        contentType: "application/x-www-form-urlencoded",
      }),
    );
    expect(response.status).toBe(415);
  });

  it("answers 409 at the per-account cap", async () => {
    const user = await createTestUser();
    await getPackModel().insertMany(
      Array.from({ length: MAX_SAVED_PACKS }, (_, i) => ({
        ...PACK,
        visibility: "unlisted",
        slug: `cap${String(i).padStart(7, "0")}`,
        ownerId: user.id,
      })),
    );
    const response = await POST(
      apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }),
    );
    expect(response.status).toBe(409);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("conflict");
    expect(body.error.message).toContain("200 packs");
  });

  it("lets an admin save past the cap", async () => {
    const admin = await createTestUser({ osuId: 12231334 });
    await getPackModel().insertMany(
      Array.from({ length: MAX_SAVED_PACKS }, (_, i) => ({
        ...PACK,
        visibility: "unlisted",
        slug: `adm${String(i).padStart(7, "0")}`,
        ownerId: admin.id,
      })),
    );
    const response = await POST(
      apiRequest("/api/packs", { method: "POST", body: PACK, cookie: admin.cookie }),
    );
    expect(response.status).toBe(201);
  });

  it("round-trips a reordered pack with a custom slot and a no-slot map", async () => {
    const user = await createTestUser();
    const buckets = [
      { code: "EZ", color: 4 },
      { code: "NM" },
      { code: "HD" },
      { code: "HR" },
      { code: "DT" },
      { code: "FM" },
      { code: "TB" },
    ];
    const body = {
      name: "Custom",
      slots: [
        { mod: "EZ", index: 1, beatmapId: 129891 },
        { mod: null, index: 1, beatmapId: 1872396 },
      ],
      buckets,
    };
    const created = await POST(
      apiRequest("/api/packs", { method: "POST", body, cookie: user.cookie }),
    );
    expect(created.status).toBe(201);
    const { pack } = (await created.json()) as { pack: { slug: string } };
    const read = await GET_PACK(apiRequest(`/api/packs/${pack.slug}`), slugContext(pack.slug));
    expect(await read.json()).toMatchObject({ pack: { buckets, slots: body.slots } });
  });

  it("rejects a slot in a bucket the pack doesn't define", async () => {
    const user = await createTestUser();
    const response = await POST(
      apiRequest("/api/packs", {
        method: "POST",
        cookie: user.cookie,
        body: { name: "Bad", slots: [{ mod: "EZ", index: 1, beatmapId: 1 }] },
      }),
    );
    expect(response.status).toBe(400);
  });

  it("saves and returns a custom slot's mods", async () => {
    const user = await createTestUser();
    const buckets = [
      { code: "NM" },
      { code: "HD" },
      { code: "HR" },
      { code: "DT" },
      { code: "FM" },
      { code: "HDDT", color: 4, mods: { kind: "forced", set: ["HD", "DT"] } },
      { code: "TB" },
    ];
    const body = { name: "Mods", slots: [{ mod: "HDDT", index: 1, beatmapId: 129891 }], buckets };
    const created = await POST(
      apiRequest("/api/packs", { method: "POST", body, cookie: user.cookie }),
    );
    expect(created.status).toBe(201);
    const { pack } = (await created.json()) as { pack: { slug: string } };
    const read = await GET_PACK(apiRequest(`/api/packs/${pack.slug}`), slugContext(pack.slug));
    expect(await read.json()).toMatchObject({ pack: { buckets } });
  });

  it("rejects mods osu! won't combine", async () => {
    const user = await createTestUser();
    const buckets = [
      { code: "NM" },
      { code: "HD" },
      { code: "HR" },
      { code: "DT" },
      { code: "FM" },
      { code: "Bad", color: 0, mods: { kind: "forced", set: ["EZ", "HR"] } },
      { code: "TB" },
    ];
    const response = await POST(
      apiRequest("/api/packs", {
        method: "POST",
        cookie: user.cookie,
        body: { name: "Bad", slots: [{ mod: "Bad", index: 1, beatmapId: 1 }], buckets },
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/packs", () => {
  it("asks anonymous callers to sign in", async () => {
    expect((await GET(apiRequest("/api/packs"))).status).toBe(401);
  });

  it(`pages ${OWN_PAGE_SIZE} at a time with ?page=`, async () => {
    const user = await createTestUser();
    await getPackModel().insertMany(
      Array.from({ length: OWN_PAGE_SIZE + 3 }, (_, i) => ({
        ...PACK,
        visibility: "unlisted",
        slug: `own${String(i).padStart(7, "0")}`,
        ownerId: user.id,
      })),
    );
    const response = await GET(apiRequest("/api/packs?page=2", { cookie: user.cookie }));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      packs: unknown[];
      page: number;
      pageCount: number;
      total: number;
    };
    expect(body).toMatchObject({ page: 2, pageCount: 2, total: OWN_PAGE_SIZE + 3 });
    expect(body.packs).toHaveLength(3);
  });

  it("refuses ?page=0 with 400", async () => {
    const user = await createTestUser();
    const response = await GET(apiRequest("/api/packs?page=0", { cookie: user.cookie }));
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiErrorBody;
    expect(body.error.code).toBe("bad_request");
  });

  it("sets Cache-Control: private, no-store, since the list varies by viewer", async () => {
    const user = await createTestUser();
    const response = await GET(apiRequest("/api/packs", { cookie: user.cookie }));
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
});

describe("GET /api/packs/[slug] for a hidden pack", () => {
  it("is a 404 for others and visible to its owner and admins", async () => {
    const owner = await createTestUser();
    const admin = await createTestUser({ osuId: 12231334 });
    const created = await POST(
      apiRequest("/api/packs", {
        method: "POST",
        body: { ...PACK, visibility: "public" },
        cookie: owner.cookie,
      }),
    );
    const { pack } = (await created.json()) as { pack: { slug: string } };
    await getPackModel().updateOne({ slug: pack.slug }, { $set: { hiddenAt: new Date() } });
    const get = (cookie?: string) =>
      GET_PACK(apiRequest(`/api/packs/${pack.slug}`, { cookie }), slugContext(pack.slug));
    expect((await get()).status).toBe(404);
    expect((await get(owner.cookie)).status).toBe(200);
    expect((await get(admin.cookie)).status).toBe(200);
  });

  it("sets Cache-Control: private, no-store, since the response carries isOwner/isAdmin", async () => {
    const owner = await createTestUser();
    const created = await POST(
      apiRequest("/api/packs", { method: "POST", body: PACK, cookie: owner.cookie }),
    );
    const { pack } = (await created.json()) as { pack: { slug: string } };
    const response = await GET_PACK(
      apiRequest(`/api/packs/${pack.slug}`, { cookie: owner.cookie }),
      slugContext(pack.slug),
    );
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  describe("POST /api/packs content filter", () => {
    it("refuses a name with a slur, with a message the page can show", async () => {
      const user = await createTestUser();
      const response = await POST(
        apiRequest("/api/packs", {
          method: "POST",
          cookie: user.cookie,
          body: { name: "n1gg3r cup", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] },
        }),
      );
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: { code: "bad_request", message: "Please keep the name free of slurs." },
      });
    });
  });
});
