/**
 * @file tests/integration/app/api/pack-slug.test.ts
 * @desc GET/PUT/DELETE /api/packs/{slug}: visibility and owner checks (others get 404).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { DELETE, GET, PUT } from "@/app/api/packs/[slug]/route";
import { POST } from "@/app/api/packs/route";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";

setupTestDb();

const PACK = { name: "SPC Finals", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] };

const save = async (cookie: string, body: object = PACK): Promise<string> => {
  const response = await POST(apiRequest("/api/packs", { method: "POST", body, cookie }));
  return ((await response.json()) as { pack: { slug: string } }).pack.slug;
};

describe("GET /api/packs/{slug}", () => {
  it("shows an unlisted pack to anyone", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    const response = await GET(apiRequest(`/api/packs/${slug}`), slugContext(slug));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      pack: { slug, name: "SPC Finals" },
      isOwner: false,
    });
  });

  it("hides a private pack from others with 404 and shows it to the owner", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie, { ...PACK, visibility: "private" });
    expect((await GET(apiRequest(`/api/packs/${slug}`), slugContext(slug))).status).toBe(404);
    const mine = await GET(
      apiRequest(`/api/packs/${slug}`, { cookie: owner.cookie }),
      slugContext(slug),
    );
    expect(await mine.json()).toMatchObject({ isOwner: true });
  });
});

describe("PUT /api/packs/{slug}", () => {
  it("updates the owner's pack", async () => {
    const owner = await createTestUser();
    const slug = await save(owner.cookie);
    const response = await PUT(
      apiRequest(`/api/packs/${slug}`, {
        method: "PUT",
        cookie: owner.cookie,
        body: { ...PACK, name: "Renamed", visibility: "private" },
      }),
      slugContext(slug),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      pack: { name: "Renamed", visibility: "private" },
    });
  });

  it("answers 404 to someone else, and 401 to nobody", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const slug = await save(owner.cookie);
    const body = { ...PACK, name: "Hijacked" };
    expect(
      (
        await PUT(
          apiRequest(`/api/packs/${slug}`, { method: "PUT", body, cookie: other.cookie }),
          slugContext(slug),
        )
      ).status,
    ).toBe(404);
    expect(
      (await PUT(apiRequest(`/api/packs/${slug}`, { method: "PUT", body }), slugContext(slug)))
        .status,
    ).toBe(401);
  });
});

describe("DELETE /api/packs/{slug}", () => {
  it("deletes only for the owner", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const slug = await save(owner.cookie);
    expect(
      (
        await DELETE(
          apiRequest(`/api/packs/${slug}`, { method: "DELETE", cookie: other.cookie }),
          slugContext(slug),
        )
      ).status,
    ).toBe(404);
    expect(
      (
        await DELETE(
          apiRequest(`/api/packs/${slug}`, { method: "DELETE", cookie: owner.cookie }),
          slugContext(slug),
        )
      ).status,
    ).toBe(204);
    expect((await GET(apiRequest(`/api/packs/${slug}`), slugContext(slug))).status).toBe(404);
  });
});
