/**
 * @file tests/integration/app/api/pack-write-limits.test.ts
 * @desc The /api/v1 write limit (RATE_LIMITS.apiWrite, per user) on the session pack routes:
 *       POST /api/packs, PUT/DELETE /api/packs/{slug}, POST/DELETE /api/packs/{slug}/exports.
 *       Past it: 429 with Retry-After. The web and the API share one allowance.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE as DELETE_EXPORT, POST as POST_EXPORT } from "@/app/api/packs/[slug]/exports/route";
import { DELETE, PUT } from "@/app/api/packs/[slug]/route";
import { POST } from "@/app/api/packs/route";
import { POST as V1_POST } from "@/app/api/v1/packs/route";
import { RATE_LIMITS } from "@/constants/api";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { rateLimitId, windowFor } from "@/lib/rate-limit";
import { createApiKey } from "@/services/api-keys";
import { createPack } from "@/services/packs";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest, noContext, slugContext } from "../../../helpers/requests";

setupTestDb();

beforeEach(() => {
  // Only Date is faked: 5 s into the next window, so no window rolls over mid-test (and the
  // counters' expiresAt stays in the future for the TTL monitor).
  const size = RATE_LIMITS.apiWrite.windowSeconds * 1000;
  vi.useFakeTimers({ toFake: ["Date"], now: (Math.floor(Date.now() / size) + 1) * size + 5000 });
});
afterEach(() => {
  vi.useRealTimers();
});

const PACK = { name: "SPC Finals", slots: [{ mod: "NM" as const, index: 1, beatmapId: 129891 }] };
const MAGNET = `magnet:?xt=urn:btih:${"1".padStart(40, "0")}&dn=SPC`;
const rule = RATE_LIMITS.apiWrite;

/** Spends the user's whole write allowance for this window. */
const spendWrites = async (userId: string) => {
  const now = Date.now();
  await getDb()
    .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
    .insertOne({
      _id: rateLimitId(rule, userId, now),
      count: rule.limit,
      expiresAt: windowFor(rule, now).expiresAt,
    });
};

const expectLimited = async (response: Response) => {
  expect(response.status).toBe(429);
  expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  expect((await response.json()).error.code).toBe("rate_limited");
};

describe("session pack writes", () => {
  it(`allow ${RATE_LIMITS.apiWrite.limit} saves a minute, then answer 429 with Retry-After`, async () => {
    const user = await createTestUser();
    const save = () =>
      POST(apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }));
    for (let n = 0; n < rule.limit; n++) expect((await save()).status).toBe(201);
    await expectLimited(await save());
  });

  it("limit PUT and DELETE on /api/packs/{slug} and both export writes", async () => {
    const user = await createTestUser();
    const pack = await createPack(user.id, { ...PACK, visibility: "private" });
    await spendWrites(user.id);
    const path = `/api/packs/${pack.slug}`;
    const context = slugContext(pack.slug);
    await expectLimited(
      await PUT(apiRequest(path, { method: "PUT", body: PACK, cookie: user.cookie }), context),
    );
    await expectLimited(
      await DELETE(apiRequest(path, { method: "DELETE", cookie: user.cookie }), context),
    );
    await expectLimited(
      await POST_EXPORT(
        apiRequest(`${path}/exports`, {
          method: "POST",
          body: { kind: "magnet", url: MAGNET, packKey: "x" },
          cookie: user.cookie,
        }),
        context,
      ),
    );
    await expectLimited(
      await DELETE_EXPORT(
        apiRequest(`${path}/exports?url=${encodeURIComponent(MAGNET)}`, {
          method: "DELETE",
          cookie: user.cookie,
        }),
        context,
      ),
    );
  });

  it("share one allowance with /api/v1 writes", async () => {
    const user = await createTestUser();
    const { key } = await createApiKey(user.id);
    for (let n = 0; n < 6; n++) {
      const response = await V1_POST(
        apiRequest("/api/v1/packs", {
          method: "POST",
          body: PACK,
          headers: { authorization: `Bearer ${key}` },
        }),
        noContext,
      );
      expect(response.status).toBe(201);
    }
    const save = () =>
      POST(apiRequest("/api/packs", { method: "POST", body: PACK, cookie: user.cookie }));
    for (let n = 0; n < 4; n++) expect((await save()).status).toBe(201);
    await expectLimited(await save());
  });
});
