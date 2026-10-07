/**
 * @file tests/integration/app/api/me.test.ts
 * @desc DELETE /api/me removes the caller's packs data (API key, packs, their history) and
 *       nothing that belongs to anyone else, leaves the haruhime account and session alone (still
 *       signed in), counts deletions per osu! account, and refuses other sites. The key goes
 *       before the packs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/me/route";
import { POST } from "@/app/api/packs/route";
import { RATE_LIMITS } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getUserFromHeaders } from "@/lib/auth";
import { getDb, getIdentityDb } from "@/lib/db";
import { packRevisions } from "@/lib/pack-revisions";
import { limiter } from "@/lib/rate-limit";
import { getPackModel } from "@/models/Pack";
import { createApiKey } from "@/services/api-keys";
import { apiCaller } from "../../../helpers/api-key";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/requests";

setupTestDb();
afterEach(() => vi.restoreAllMocks());

const PACK = { name: "SPC Finals", slots: [{ mod: "NM", index: 1, beatmapId: 129891 }] };

describe("DELETE /api/me", () => {
  it("asks anonymous callers to sign in", async () => {
    expect((await DELETE(apiRequest("/api/me", { method: "DELETE" }))).status).toBe(401);
  });

  it("refuses a request from another origin and keeps the packs", async () => {
    const user = await createTestUser();
    await POST(apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }));
    const response = await DELETE(
      apiRequest("/api/me", {
        method: "DELETE",
        cookie: user.cookie,
        headers: { origin: "https://pools.haruhime.moe" },
      }),
    );
    expect(response.status).toBe(403);
    expect(await getPackModel().countDocuments({ ownerId: new ObjectId(user.id) })).toBe(1);
  });

  it("deletes the packs data and nothing else, and leaves the haruhime account", async () => {
    const leaving = await createTestUser();
    const staying = await createTestUser();
    for (const user of [leaving, leaving, staying]) {
      await POST(apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }));
    }
    const id = new ObjectId(leaving.id);
    expect(await getPackModel().countDocuments({ ownerId: id })).toBe(2);
    const slugs = (await getPackModel().find({ ownerId: id }, { slug: 1 }).lean()).map(
      (doc) => doc.slug,
    );
    for (const slug of slugs) expect(await packRevisions.head(slug)).not.toBeNull();

    const response = await DELETE(
      apiRequest("/api/me", { method: "DELETE", cookie: leaving.cookie }),
    );
    expect(response.status).toBe(204);

    for (const slug of slugs) expect(await packRevisions.head(slug)).toBeNull();
    expect(await getPackModel().countDocuments({ ownerId: id })).toBe(0);
    // The haruhime account is the hub's: untouched, still signed in.
    expect(await getIdentityDb().collection("user").countDocuments({ _id: id })).toBe(1);
    expect(await getIdentityDb().collection("session").countDocuments({ userId: id })).toBe(1);
    expect(await getUserFromHeaders(new Headers({ cookie: leaving.cookie }))).not.toBeNull();

    expect(await getPackModel().countDocuments({ ownerId: new ObjectId(staying.id) })).toBe(1);
    expect(await getUserFromHeaders(new Headers({ cookie: staying.cookie }))).not.toBeNull();
  });

  it("allows RATE_LIMITS.dataDelete deletions an hour per osu! account, then 429", async () => {
    const user = await createTestUser();
    for (let i = 0; i < RATE_LIMITS.dataDelete.limit; i++) {
      const response = await DELETE(
        apiRequest("/api/me", { method: "DELETE", cookie: user.cookie }),
      );
      expect(response.status).toBe(204);
    }
    const refused = await DELETE(apiRequest("/api/me", { method: "DELETE", cookie: user.cookie }));
    expect(refused.status).toBe(429);
  });

  it("revokes the API key before deleting packs, so an API write can't slip in", async () => {
    const leaving = await createTestUser();
    const { key } = await createApiKey(leaving.id);
    const packs = getPackModel();
    const original = packs.deleteMany.bind(packs);
    let keyWorkedDuringPackDeletion: boolean | undefined;
    vi.spyOn(packs, "deleteMany").mockImplementation(((...args: Parameters<typeof original>) => {
      return apiCaller(key).then((caller) => {
        keyWorkedDuringPackDeletion = caller !== null;
        return original(...args);
      });
    }) as unknown as typeof packs.deleteMany);

    await DELETE(apiRequest("/api/me", { method: "DELETE", cookie: leaving.cookie }));
    expect(keyWorkedDuringPackDeletion).toBe(false);
  });

  it("deletes the API key and the user's rate-limit counters, and nobody else's", async () => {
    const leaving = await createTestUser();
    const staying = await createTestUser();
    const gone = await createApiKey(leaving.id);
    const kept = await createApiKey(staying.id);
    await limiter.hit(RATE_LIMITS.api, leaving.id);
    await limiter.hit(RATE_LIMITS.keyCreate, leaving.id);
    await limiter.hit(RATE_LIMITS.api, staying.id);

    const response = await DELETE(
      apiRequest("/api/me", { method: "DELETE", cookie: leaving.cookie }),
    );
    expect(response.status).toBe(204);

    expect(
      await getDb()
        .collection("api_keys")
        .countDocuments({ userId: new ObjectId(leaving.id) }),
    ).toBe(0);
    // Before any key goes through the guard, which counts its own (per IP) hits.
    // The deletion's own counter is keyed by osu! id, so deleting doesn't reset it.
    const counters = (await getDb().collection(RATE_LIMITS_COLLECTION).find().toArray()).filter(
      (doc) => !String(doc._id).startsWith(`${RATE_LIMITS.dataDelete.scope}:`),
    );
    expect(counters.map((doc) => String(doc._id).split(":")[1])).toEqual([staying.id]);
    expect(await apiCaller(gone.key)).toBeNull();
    expect(await apiCaller(kept.key)).toMatchObject({ id: staying.id });
  });
});
