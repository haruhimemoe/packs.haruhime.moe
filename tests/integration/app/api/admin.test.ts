/**
 * @file tests/integration/app/api/admin.test.ts
 * @desc /api/admin/packs/[slug]: 404 for everyone but admins and for private packs; hide, unhide,
 *       delete; moderation never moves updatedAt.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { revalidatePath } from "next/cache";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH } from "@/app/api/admin/packs/[slug]/route";
import { getPackModel } from "@/models/Pack";
import { createPack, getPackForViewer } from "@/services/packs";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";

const ADMIN_OSU_ID = 12231334;
vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
setupTestDb();

const PACK = { name: "SPC Finals", slots: [{ mod: "NM" as const, index: 1, beatmapId: 129891 }] };

const setup = async (visibility: "public" | "unlisted" | "private" = "public") => {
  const admin = await createTestUser({ osuId: ADMIN_OSU_ID });
  const host = await createTestUser({ username: "host" });
  const pack = await createPack(host.id, { ...PACK, visibility });
  return { admin, host, pack };
};

const patch = (slug: string, body: unknown, cookie?: string) =>
  PATCH(
    apiRequest(`/api/admin/packs/${slug}`, { method: "PATCH", body, cookie }),
    slugContext(slug),
  );
const remove = (slug: string, cookie?: string) =>
  DELETE(apiRequest(`/api/admin/packs/${slug}`, { method: "DELETE", cookie }), slugContext(slug));

describe("PATCH /api/admin/packs/[slug]", () => {
  beforeEach(() => vi.mocked(revalidatePath).mockClear());

  it("is a 404 for anonymous callers and non-admins", async () => {
    const { host, pack } = await setup();
    for (const cookie of [undefined, host.cookie]) {
      const response = await patch(pack.slug, { hidden: true }, cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({
        error: { code: "not_found", message: "Not found." },
      });
    }
    expect((await getPackForViewer(pack.slug, null))?.pack.hiddenAt).toBeUndefined();
  });

  it("rejects a bad body", async () => {
    const { admin, pack } = await setup();
    expect((await patch(pack.slug, { hidden: "yes" }, admin.cookie)).status).toBe(400);
  });

  it("hides and unhides without moving updatedAt", async () => {
    const { admin, host, pack } = await setup();
    const hidden = await patch(pack.slug, { hidden: true }, admin.cookie);
    expect(hidden.status).toBe(200);
    const body = (await hidden.json()) as { pack: { hiddenAt: string | null } };
    expect(body.pack).toMatchObject({ ownerName: "host", updatedAt: pack.updatedAt });
    expect(body.pack.hiddenAt).toEqual(expect.any(String));
    expect(await getPackForViewer(pack.slug, null)).toBeNull();
    expect(await getPackForViewer(pack.slug, host.id)).not.toBeNull();
    expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");

    const shown = await patch(pack.slug, { hidden: false }, admin.cookie);
    expect(
      ((await shown.json()) as { pack: { hiddenAt: string | null } }).pack.hiddenAt,
    ).toBeNull();
    expect(await getPackForViewer(pack.slug, null)).not.toBeNull();
    const doc = await getPackModel().findOne({ slug: pack.slug }).lean();
    expect(doc?.updatedAt.toISOString()).toBe(pack.updatedAt);
    expect(doc && "hiddenBy" in doc).toBe(false);
  });

  it("is a 404 for a private pack, which stays untouched", async () => {
    const { admin, pack } = await setup("private");
    expect((await patch(pack.slug, { hidden: true }, admin.cookie)).status).toBe(404);
    expect((await remove(pack.slug, admin.cookie)).status).toBe(404);
    const doc = await getPackModel().findOne({ slug: pack.slug }).lean();
    expect(doc).not.toBeNull();
    expect(doc?.hiddenAt).toBeUndefined();
  });

  it("is a 404 for unknown and malformed slugs", async () => {
    const { admin } = await setup();
    expect((await patch("zzzzzzzzzz", { hidden: true }, admin.cookie)).status).toBe(404);
    expect((await patch("..%2Fetc", { hidden: true }, admin.cookie)).status).toBe(404);
  });
});

describe("DELETE /api/admin/packs/[slug]", () => {
  it("deletes a public or unlisted pack for admins only", async () => {
    const { admin, host, pack } = await setup("unlisted");
    expect((await remove(pack.slug, host.cookie)).status).toBe(404);
    expect((await remove(pack.slug, admin.cookie)).status).toBe(204);
    expect(await getPackModel().countDocuments({ slug: pack.slug })).toBe(0);
  });
});
