/**
 * @file tests/integration/app/api/admin-pins.test.ts
 * @desc /api/admin/pins and /api/admin/pins/[slug]: the same 404 for everyone but admins (and
 *       nothing changes), refused from another site, pin and unpin answering the pinned list,
 *       409 for packs that can't be pinned and past the limit, reorder, and the admin's view of a
 *       pack saying whether it's pinned. Hiding through the moderation route unpins.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { PATCH } from "@/app/api/admin/packs/[slug]/route";
import { DELETE, PUT } from "@/app/api/admin/pins/[slug]/route";
import { PUT as reorder } from "@/app/api/admin/pins/route";
import { GET as getPack } from "@/app/api/packs/[slug]/route";
import { MAX_PINNED_PACKS } from "@/constants/public-packs";
import { CROSS_SITE_REFUSED } from "@/lib/api";
import { createPack } from "@/services/packs";
import { isPackPinned, listPinnedForAdmin } from "@/services/pins";
import { PIN_LIMIT, PIN_PUBLIC_ONLY, PINS_CHANGED } from "@/utils/pins";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, slugContext } from "../../../helpers/requests";

const ADMIN_OSU_ID = 12231334;
vi.stubEnv("ADMIN_OSU_IDS", String(ADMIN_OSU_ID));
setupTestDb();

const EVIL = { origin: "https://evil.example" };
const NOT_FOUND = { error: { code: "not_found", message: "Not found." } };

type PinsBody = { pins: { slug: string; name: string }[] };
type ErrorBody = { error: { code: string; message: string } };

const setup = async (count = 1) => {
  const admin = await createTestUser({ osuId: ADMIN_OSU_ID });
  const host = await createTestUser({ username: "host" });
  const slugs: string[] = [];
  for (let i = 0; i < count; i++) {
    const pack = await createPack(host.id, {
      name: `Pack ${i}`,
      slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
      visibility: "public",
    });
    slugs.push(pack.slug);
  }
  return { admin, host, slugs };
};

const pin = (slug: string, cookie?: string, headers: Record<string, string> = {}) =>
  PUT(apiRequest(`/api/admin/pins/${slug}`, { method: "PUT", cookie, headers }), slugContext(slug));
const unpin = (slug: string, cookie?: string, headers: Record<string, string> = {}) =>
  DELETE(
    apiRequest(`/api/admin/pins/${slug}`, { method: "DELETE", cookie, headers }),
    slugContext(slug),
  );
const order = (body: unknown, cookie?: string, headers: Record<string, string> = {}) =>
  reorder(apiRequest("/api/admin/pins", { method: "PUT", body, cookie, headers }));

describe("PUT /api/admin/pins/[slug]", () => {
  it("is a 404 for anonymous callers and non-admins, and pins nothing", async () => {
    const { host, slugs } = await setup();
    const slug = slugs[0] as string;
    for (const cookie of [undefined, host.cookie]) {
      const response = await pin(slug, cookie);
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual(NOT_FOUND);
    }
    expect(await isPackPinned(slug)).toBe(false);
  });

  it("refuses a request from another site", async () => {
    const { admin, slugs } = await setup();
    const slug = slugs[0] as string;
    for (const headers of [EVIL, { "sec-fetch-site": "cross-site" }]) {
      const response = await pin(slug, admin.cookie, headers);
      expect(response.status).toBe(403);
      expect(((await response.json()) as ErrorBody).error.message).toBe(CROSS_SITE_REFUSED);
    }
    expect(await isPackPinned(slug)).toBe(false);
  });

  it("pins a public pack for an admin and answers the pinned list", async () => {
    const { admin, slugs } = await setup(2);
    await pin(slugs[0] as string, admin.cookie, { "sec-fetch-site": "same-origin" });
    const response = await pin(slugs[1] as string, admin.cookie);
    expect(response.status).toBe(200);
    expect(((await response.json()) as PinsBody).pins).toEqual([
      { slug: slugs[0], name: "Pack 0", ownerName: "host", pinnedAt: expect.any(String) },
      { slug: slugs[1], name: "Pack 1", ownerName: "host", pinnedAt: expect.any(String) },
    ]);
  });

  it(`refuses a pin past ${MAX_PINNED_PACKS} with a 409 that says so`, async () => {
    const { admin, slugs } = await setup(MAX_PINNED_PACKS + 1);
    for (const slug of slugs.slice(0, MAX_PINNED_PACKS)) {
      expect((await pin(slug, admin.cookie)).status).toBe(200);
    }
    const response = await pin(slugs[MAX_PINNED_PACKS] as string, admin.cookie);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: { code: "conflict", message: PIN_LIMIT } });
    expect(await listPinnedForAdmin()).toHaveLength(MAX_PINNED_PACKS);
  });

  it("refuses an unlisted pack with a 409, and a private one with the same 404", async () => {
    const { admin, host } = await setup(0);
    const slots = [{ mod: "NM" as const, index: 1, beatmapId: 129891 }];
    const unlisted = await createPack(host.id, { name: "U", slots, visibility: "unlisted" });
    const secret = await createPack(host.id, { name: "P", slots, visibility: "private" });
    const refused = await pin(unlisted.slug, admin.cookie);
    expect(refused.status).toBe(409);
    expect(((await refused.json()) as ErrorBody).error.message).toBe(PIN_PUBLIC_ONLY);
    const missing = await pin(secret.slug, admin.cookie);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual(NOT_FOUND);
    expect((await pin("zzzzzzzzzz", admin.cookie)).status).toBe(404);
  });
});

describe("DELETE /api/admin/pins/[slug]", () => {
  it("unpins for admins only, and refuses other sites", async () => {
    const { admin, host, slugs } = await setup();
    const slug = slugs[0] as string;
    await pin(slug, admin.cookie);
    for (const cookie of [undefined, host.cookie]) {
      expect(await (await unpin(slug, cookie)).json()).toEqual(NOT_FOUND);
    }
    expect((await unpin(slug, admin.cookie, EVIL)).status).toBe(403);
    expect(await isPackPinned(slug)).toBe(true);
    const response = await unpin(slug, admin.cookie);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ pins: [] });
    expect(await isPackPinned(slug)).toBe(false);
  });
});

describe("PUT /api/admin/pins", () => {
  it("reorders the pinned packs for admins only", async () => {
    const { admin, host, slugs } = await setup(3);
    for (const slug of slugs) await pin(slug, admin.cookie);
    const wanted = [slugs[2], slugs[0], slugs[1]];
    for (const cookie of [undefined, host.cookie]) {
      expect(await (await order({ slugs: wanted }, cookie)).json()).toEqual(NOT_FOUND);
    }
    expect((await order({ slugs: wanted }, admin.cookie, EVIL)).status).toBe(403);
    expect((await listPinnedForAdmin()).map((p) => p.slug)).toEqual(slugs);
    const response = await order({ slugs: wanted }, admin.cookie);
    expect(response.status).toBe(200);
    expect(((await response.json()) as PinsBody).pins.map((p) => p.slug)).toEqual(wanted);
  });

  it("refuses a list that doesn't match what's pinned, and a bad body", async () => {
    const { admin, slugs } = await setup(2);
    await pin(slugs[0] as string, admin.cookie);
    const stale = await order({ slugs: [slugs[1]] }, admin.cookie);
    expect(stale.status).toBe(409);
    expect(((await stale.json()) as ErrorBody).error.message).toBe(PINS_CHANGED);
    expect((await order({ slugs: ["../etc"] }, admin.cookie)).status).toBe(400);
    expect((await order({ order: [] }, admin.cookie)).status).toBe(400);
    const tooMany = Array.from({ length: MAX_PINNED_PACKS + 1 }, (_, i) => `${i}`.padEnd(10, "a"));
    expect((await order({ slugs: tooMany }, admin.cookie)).status).toBe(400);
  });
});

describe("pins and the rest of the site", () => {
  it("tells an admin's view of a pack whether it's pinned, and nobody else", async () => {
    const { admin, host, slugs } = await setup();
    const slug = slugs[0] as string;
    const view = async (cookie?: string) =>
      (await (
        await getPack(apiRequest(`/api/packs/${slug}`, { cookie }), slugContext(slug))
      ).json()) as Record<string, unknown>;
    expect((await view(admin.cookie)).pinned).toBe(false);
    await pin(slug, admin.cookie);
    expect((await view(admin.cookie)).pinned).toBe(true);
    expect(await view(host.cookie)).not.toHaveProperty("pinned");
    expect(await view()).not.toHaveProperty("pinned");
  });

  it("hiding a pinned pack through moderation unpins it", async () => {
    const { admin, slugs } = await setup();
    const slug = slugs[0] as string;
    await pin(slug, admin.cookie);
    const hidden = await PATCH(
      apiRequest(`/api/admin/packs/${slug}`, {
        method: "PATCH",
        body: { hidden: true },
        cookie: admin.cookie,
      }),
      slugContext(slug),
    );
    expect(hidden.status).toBe(200);
    expect(((await hidden.json()) as { pack: { pinnedAt: string | null } }).pack.pinnedAt).toBe(
      null,
    );
    expect(await isPackPinned(slug)).toBe(false);
  });
});
