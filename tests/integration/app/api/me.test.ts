/**
 * @file tests/integration/app/api/me.test.ts
 * @desc DELETE /api/me removes the user, their sessions, osu! account link, API key, and packs,
 *       and nothing that belongs to anyone else. The key goes before the packs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { ObjectId } from "mongodb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "@/app/api/me/route";
import { POST } from "@/app/api/packs/route";
import { RATE_LIMITS } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getUserFromHeaders } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { hitRateLimit } from "@/lib/rate-limit";
import { getApiKeyModel } from "@/models/ApiKey";
import { getPackModel } from "@/models/Pack";
import { authenticateApiKey, createApiKey } from "@/services/api-keys";
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

  it("refuses a request from another origin and keeps the account", async () => {
    const user = await createTestUser();
    const response = await DELETE(
      apiRequest("/api/me", {
        method: "DELETE",
        cookie: user.cookie,
        headers: { origin: "https://pools.haruhime.moe" },
      }),
    );
    expect(response.status).toBe(403);
    expect(
      await getDb()
        .collection("user")
        .countDocuments({ _id: new ObjectId(user.id) }),
    ).toBe(1);
  });

  it("deletes the account and everything it owns, and nothing else", async () => {
    const leaving = await createTestUser();
    const staying = await createTestUser();
    for (const user of [leaving, leaving, staying]) {
      await POST(apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }));
    }
    const id = new ObjectId(leaving.id);
    // Preconditions: better-auth stores userId as an ObjectId, so the deletes below can match.
    expect(await getDb().collection("user").countDocuments({ _id: id })).toBe(1);
    expect(await getDb().collection("session").countDocuments({ userId: id })).toBe(1);
    expect(await getDb().collection("account").countDocuments({ userId: id })).toBe(1);
    expect(await getPackModel().countDocuments({ ownerId: id })).toBe(2);

    const response = await DELETE(
      apiRequest("/api/me", { method: "DELETE", cookie: leaving.cookie }),
    );
    expect(response.status).toBe(204);

    expect(await getPackModel().countDocuments({ ownerId: id })).toBe(0);
    expect(await getDb().collection("user").countDocuments({ _id: id })).toBe(0);
    expect(await getDb().collection("session").countDocuments({ userId: id })).toBe(0);
    expect(await getDb().collection("account").countDocuments({ userId: id })).toBe(0);
    expect(await getUserFromHeaders(new Headers({ cookie: leaving.cookie }))).toBeNull();

    expect(await getPackModel().countDocuments({ ownerId: new ObjectId(staying.id) })).toBe(1);
    expect(await getUserFromHeaders(new Headers({ cookie: staying.cookie }))).not.toBeNull();
  });

  it("answers 401 to a cookie whose account is already gone", async () => {
    const user = await createTestUser();
    await DELETE(apiRequest("/api/me", { method: "DELETE", cookie: user.cookie }));
    const again = await POST(
      apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }),
    );
    expect(again.status).toBe(401);
  });

  it("revokes the API key before deleting packs, so an API write can't slip in", async () => {
    const leaving = await createTestUser();
    const { key } = await createApiKey(leaving.id);
    const packs = getPackModel();
    const original = packs.deleteMany.bind(packs);
    let keyWorkedDuringPackDeletion: boolean | undefined;
    vi.spyOn(packs, "deleteMany").mockImplementation(((...args: Parameters<typeof original>) => {
      return authenticateApiKey(key).then((caller) => {
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
    await hitRateLimit(RATE_LIMITS.api, leaving.id);
    await hitRateLimit(RATE_LIMITS.keyCreate, leaving.id);
    await hitRateLimit(RATE_LIMITS.api, staying.id);

    const response = await DELETE(
      apiRequest("/api/me", { method: "DELETE", cookie: leaving.cookie }),
    );
    expect(response.status).toBe(204);

    expect(await getApiKeyModel().countDocuments({ userId: new ObjectId(leaving.id) })).toBe(0);
    expect(await authenticateApiKey(gone.key)).toBeNull();
    const counters = await getDb().collection(RATE_LIMITS_COLLECTION).find().toArray();
    expect(counters.map((doc) => String(doc._id).split(":")[1])).toEqual([staying.id]);
    expect(await authenticateApiKey(kept.key)).toMatchObject({ id: staying.id });
  });
});
