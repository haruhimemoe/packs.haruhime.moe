/**
 * @file tests/integration/app/api/v1/packs-write.test.ts
 * @desc POST/PUT/DELETE through /api/v1: same rules and revalidation as the site, owner-only,
 *       and the 10-writes-a-minute limit (every write method, per account, on top of the
 *       60-a-minute limit, headers from whichever counter runs out first). Admin keys skip the
 *       saved-pack cap.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { encodePackKey } from "@haruhimemoe/pool";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as ME } from "@/app/api/v1/me/route";
import { DELETE, PUT } from "@/app/api/v1/packs/[slug]/route";
import { POST } from "@/app/api/v1/packs/route";
import { RATE_LIMITS, type RateLimitRule } from "@/constants/api";
import { MAX_SAVED_PACKS } from "@/constants/pack";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { connectedDb } from "@/lib/db";
import { rateLimitId } from "@/lib/rate-limit";
import { getPackModel } from "@/models/Pack";
import { apiPackResponseSchema } from "@/schemas/api";
import { createApiKey } from "@/services/api-keys";
import { createPack } from "@/services/packs";
import { bearer, createTestApiKey, freezeTime, seedRateLimit } from "../../../../helpers/api-key";
import { createTestUser } from "../../../../helpers/auth";
import { setupTestDb } from "../../../../helpers/db";
import { apiRequest, noContext, slugContext } from "../../../../helpers/requests";

vi.stubEnv("ADMIN_OSU_IDS", "12231334");
setupTestDb();
beforeEach(() => {
  freezeTime();
  vi.mocked(revalidatePath).mockClear();
});
afterEach(() => vi.useRealTimers());

const PACK = { name: "SPC Finals", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] };
const counted = async (rule: RateLimitRule, subject: string): Promise<number> => {
  const doc = await (await connectedDb())
    .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
    .findOne({ _id: rateLimitId(rule, subject, Date.now()) });
  return doc?.count ?? 0;
};
const paths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path);

const post = (key: string, body: unknown, contentType?: string) =>
  POST(
    apiRequest("/api/v1/packs", { method: "POST", body, contentType, headers: bearer(key) }),
    noContext,
  );
const put = (key: string, slug: string, body: unknown) =>
  PUT(
    apiRequest(`/api/v1/packs/${slug}`, { method: "PUT", body, headers: bearer(key) }),
    slugContext(slug),
  );
const remove = (key: string, slug: string) =>
  DELETE(
    apiRequest(`/api/v1/packs/${slug}`, { method: "DELETE", headers: bearer(key) }),
    slugContext(slug),
  );

describe("POST /api/v1/packs", () => {
  it("saves a pack for the key's owner", async () => {
    const user = await createTestUser({ username: "host" });
    const key = await createTestApiKey(user.id);
    const response = await post(key, { ...PACK, visibility: "public" });
    expect(response.status).toBe(201);
    const { pack } = apiPackResponseSchema.parse(await response.json());
    expect(pack).toMatchObject({
      name: "SPC Finals",
      visibility: "public",
      ownerName: "host",
      packKey: encodePackKey(PACK),
    });
    expect(paths()).toContain("/(public)/packs");
  });

  it("ignores an ownerId or slug in the body", async () => {
    const user = await createTestUser();
    const other = await createTestUser();
    const key = await createTestApiKey(user.id);
    const response = await post(key, { ...PACK, ownerId: other.id, slug: "zzzzzzzzzz" });
    const { pack } = apiPackResponseSchema.parse(await response.json());
    expect(pack.slug).not.toBe("zzzzzzzzzz");
    const stored = await getPackModel().findOne({ slug: pack.slug }).lean();
    expect(stored?.ownerId.toString()).toBe(user.id);
    expect(await getPackModel().countDocuments({ ownerId: new ObjectId(other.id) })).toBe(0);
  });

  it("applies the site's rules: schema, slur filter, JSON only", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const empty = await post(key, { name: "Empty", slots: [] });
    expect(empty.status).toBe(400);
    expect(await empty.json()).toEqual({
      error: { code: "bad_request", message: "Add at least one map before saving." },
    });
    const slur = await post(key, { ...PACK, name: "n1gg3r cup" });
    expect(await slur.json()).toEqual({
      error: { code: "bad_request", message: "Please keep the name free of slurs." },
    });
    const form = await post(key, "name=x", "application/x-www-form-urlencoded");
    expect(form.status).toBe(415);
  });

  it("answers 409 conflict at the 200-pack cap", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await getPackModel().insertMany(
      Array.from({ length: MAX_SAVED_PACKS }, (_, i) => ({
        ...PACK,
        visibility: "unlisted",
        slug: `cap${String(i).padStart(7, "0")}`,
        ownerId: user.id,
      })),
    );
    const response = await post(key, PACK);
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: { code: "conflict" } });
  });

  it("lets an admin's key save past the cap", async () => {
    const admin = await createTestUser({ osuId: 12231334 });
    const key = await createTestApiKey(admin.id);
    await getPackModel().insertMany(
      Array.from({ length: MAX_SAVED_PACKS }, (_, i) => ({
        ...PACK,
        visibility: "unlisted",
        slug: `adm${String(i).padStart(7, "0")}`,
        ownerId: admin.id,
      })),
    );
    const response = await post(key, PACK);
    expect(response.status).toBe(201);
  });
});

describe("PUT /api/v1/packs/{slug}", () => {
  it("updates the owner's pack and revalidates its page", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const { slug } = await createPack(user.id, { ...PACK, visibility: "unlisted" });
    const response = await put(key, slug, { ...PACK, name: "Renamed" });
    expect(response.status).toBe(200);
    expect(apiPackResponseSchema.parse(await response.json()).pack).toMatchObject({
      slug,
      name: "Renamed",
      packKey: encodePackKey({ ...PACK, name: "Renamed" }),
    });
    expect(paths()).toContain(`/p/${slug}`);
  });

  it("answers 404 for someone else's pack and leaves it alone", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const { slug } = await createPack(owner.id, { ...PACK, visibility: "public" });
    const response = await put(await createTestApiKey(other.id), slug, { ...PACK, name: "Hijack" });
    expect(response.status).toBe(404);
    expect((await getPackModel().findOne({ slug }).lean())?.name).toBe("SPC Finals");
  });
});

describe("DELETE /api/v1/packs/{slug}", () => {
  it("deletes only the owner's pack", async () => {
    const owner = await createTestUser();
    const other = await createTestUser();
    const { slug } = await createPack(owner.id, { ...PACK, visibility: "public" });
    expect((await remove(await createTestApiKey(other.id), slug)).status).toBe(404);
    expect(await getPackModel().countDocuments({ slug })).toBe(1);
    expect((await remove(await createTestApiKey(owner.id), slug)).status).toBe(204);
    expect(await getPackModel().countDocuments({ slug })).toBe(0);
    expect(paths()).toContain(`/p/${slug}`);
  });
});

describe("write limit", () => {
  it("shows the write counter on a write", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const response = await post(key, PACK);
    expect(response.headers.get("RateLimit-Limit")).toBe("10");
    expect(response.headers.get("RateLimit-Remaining")).toBe("9");
  });

  it("answers 429 after 10 writes a minute, and reads still work", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.apiWrite, user.id, 10);
    const refused = await post(key, PACK);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("50");
    expect(refused.headers.get("RateLimit-Limit")).toBe("10");
    expect(await getPackModel().countDocuments({ ownerId: new ObjectId(user.id) })).toBe(0);
    const read = await ME(apiRequest("/api/v1/me", { headers: bearer(key) }), noContext);
    expect(read.status).toBe(200);
  });

  it("counts PUT and DELETE as writes too", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const { slug } = await createPack(user.id, { ...PACK, visibility: "public" });
    await seedRateLimit(RATE_LIMITS.apiWrite, user.id, 10);
    const updated = await put(key, slug, { ...PACK, name: "Renamed" });
    expect(updated.status).toBe(429);
    expect((await remove(key, slug)).status).toBe(429);
    expect((await getPackModel().findOne({ slug }).lean())?.name).toBe("SPC Finals");
  });

  it("doesn't count reads as writes", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await ME(apiRequest("/api/v1/me", { headers: bearer(key) }), noContext);
    expect(await counted(RATE_LIMITS.apiWrite, user.id)).toBe(0);
    await post(key, PACK);
    expect(await counted(RATE_LIMITS.apiWrite, user.id)).toBe(1);
    expect(await counted(RATE_LIMITS.api, user.id)).toBe(2);
  });

  it("shows the per-account counter when it has fewer requests left", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.api, user.id, 55);
    const response = await post(key, PACK);
    expect(response.status).toBe(201);
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    expect(response.headers.get("RateLimit-Remaining")).toBe("4");
  });

  it("refuses a write at the per-account limit without counting it as a write", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.api, user.id, 60);
    const refused = await post(key, PACK);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("RateLimit-Limit")).toBe("60");
    expect(await counted(RATE_LIMITS.apiWrite, user.id)).toBe(0);
    expect(await getPackModel().countDocuments({ ownerId: new ObjectId(user.id) })).toBe(0);
  });

  it("counts per account, so a regenerated key doesn't start over", async () => {
    const user = await createTestUser();
    await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.apiWrite, user.id, 10);
    const { key: fresh } = await createApiKey(user.id);
    expect((await post(fresh, PACK)).status).toBe(429);
  });

  it("starts over in the next minute", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.apiWrite, user.id, 10);
    vi.setSystemTime(new Date("2026-09-22T12:01:00.000Z"));
    const response = await post(key, PACK);
    expect(response.status).toBe(201);
    expect(response.headers.get("RateLimit-Remaining")).toBe("9");
  });
});
