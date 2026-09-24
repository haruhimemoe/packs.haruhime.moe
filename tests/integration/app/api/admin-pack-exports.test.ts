/**
 * @file tests/integration/app/api/admin-pack-exports.test.ts
 * @desc DELETE /api/admin/packs/[slug]/exports?url=: admins remove one magnet link from a public
 *       or unlisted pack; everyone else (the owner included), and every private pack, gets 404.
 *       GET /api/packs/[slug] tells the page whether the viewer is an admin.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/admin/packs/[slug]/exports/route";
import { GET } from "@/app/api/packs/[slug]/route";
import { getPackModel } from "@/models/Pack";
import { addMagnet } from "@/services/pack-exports";
import { createPack } from "@/services/packs";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";

const ADMIN_OSU_ID = 12231334;
vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
setupTestDb();

const PACK = { name: "SPC Finals", slots: [{ mod: "NM" as const, index: 1, beatmapId: 129891 }] };
const magnet = (n: number) => `magnet:?xt=urn:btih:${n.toString(16).padStart(40, "0")}&dn=SPC`;

const setup = async (visibility: "public" | "unlisted" | "private" = "public") => {
  const admin = await createTestUser({ osuId: ADMIN_OSU_ID });
  const host = await createTestUser({ username: "host" });
  const other = await createTestUser();
  const pack = await createPack(host.id, { ...PACK, visibility });
  for (const n of [1, 2]) {
    await addMagnet(pack.slug, host.id, { url: magnet(n), packKey: encodePackKey(PACK) });
  }
  return { admin, host, other, slug: pack.slug };
};

const remove = (slug: string, url: string, cookie?: string, headers?: Record<string, string>) =>
  DELETE(
    apiRequest(`/api/admin/packs/${slug}/exports?url=${encodeURIComponent(url)}`, {
      method: "DELETE",
      cookie,
      headers,
    }),
    slugContext(slug),
  );

const storedUrls = async (slug: string) =>
  ((await getPackModel().findOne({ slug }).lean())?.exports ?? []).map((entry) => entry.url);

describe("DELETE /api/admin/packs/[slug]/exports", () => {
  it.each(["public", "unlisted"] as const)(
    "lets an admin remove one link from a %s pack",
    async (visibility) => {
      const { admin, slug } = await setup(visibility);
      const response = await remove(slug, magnet(1), admin.cookie);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ exports: [{ url: magnet(2) }] });
      expect(await storedUrls(slug)).toEqual([magnet(2)]);
    },
  );

  it("is a 404 for anonymous callers, other users, and the owner, and removes nothing", async () => {
    const { host, other, slug } = await setup();
    for (const cookie of [undefined, other.cookie, host.cookie]) {
      const response = await remove(slug, magnet(1), cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "not_found", message: "Not found." },
      });
    }
    expect(await storedUrls(slug)).toEqual([magnet(2), magnet(1)]);
  });

  it("is a 404 for a private pack, which stays untouched", async () => {
    const { admin, slug } = await setup("private");
    expect((await remove(slug, magnet(1), admin.cookie)).status).toBe(404);
    expect(await storedUrls(slug)).toEqual([magnet(2), magnet(1)]);
  });

  it("is a 404 for unknown and malformed slugs", async () => {
    const { admin } = await setup();
    expect((await remove("zzzzzzzzzz", magnet(1), admin.cookie)).status).toBe(404);
    expect((await remove("..%2Fetc", magnet(1), admin.cookie)).status).toBe(404);
  });

  it("answers 400 to a url that isn't a magnet link", async () => {
    const { admin, slug } = await setup();
    expect((await remove(slug, "https://example.com", admin.cookie)).status).toBe(400);
  });

  it("refuses a request from another origin", async () => {
    const { admin, slug } = await setup();
    const response = await remove(slug, magnet(1), admin.cookie, {
      origin: "https://pools.haruhime.moe",
    });
    expect(response.status).toBe(403);
    expect(await storedUrls(slug)).toHaveLength(2);
  });
});

describe("GET /api/packs/[slug] for the page", () => {
  it("says whether the viewer is an admin", async () => {
    const { admin, other, slug } = await setup();
    const view = async (cookie?: string) =>
      (await (
        await GET(apiRequest(`/api/packs/${slug}`, { cookie }), slugContext(slug))
      ).json()) as {
        isAdmin: boolean;
      };
    expect((await view(admin.cookie)).isAdmin).toBe(true);
    expect((await view(other.cookie)).isAdmin).toBe(false);
    expect((await view()).isAdmin).toBe(false);
  });
});
