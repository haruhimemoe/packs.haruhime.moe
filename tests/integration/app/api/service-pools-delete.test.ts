/**
 * @file tests/integration/app/api/service-pools-delete.test.ts
 * @desc DELETE /api/service/pools/{ref}: the token (unset or short 503, missing, short or wrong
 *       401, a failing IP 429, the right one through; no cross-site guard, since it reads no
 *       cookies), the ref (400), the pools account's pack for that pool deleted (204) with its
 *       page, /packs, the index, the homepage and the sitemap marked stale, and nothing else
 *       touched (another pool's pack, the account's other packs, another owner's pack or another
 *       origin kind with that origin id), 404 when there's none (never creating the pools
 *       account), 410 for a pool a moderator deleted (nothing touched, even a pack mid-delete),
 *       no tombstone written (a later PUT creates the pack again), and the stats job the save
 *       scheduled never bringing it back. A moderator's hide survives: deleting a hidden pack
 *       leaves a hide marker, the next PUT creates the pack hidden and keeps it, an unhide drops
 *       it, and a visible pack's delete writes none (and drops a stale one). The mirror and osu!
 *       are MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Sun Sep 27, 2026
 * @modified Sun Sep 27, 2026
 */

import type { PackInput } from "@haruhimemoe/pool/service";
import { ObjectId } from "mongodb";
import { revalidatePath } from "next/cache";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PUT } from "@/app/api/service/pools/[ref]/route";
import { RATE_LIMITS } from "@/constants/api";
import {
  DELETED_ORIGINS_COLLECTION,
  HIDDEN_ORIGINS_COLLECTION,
  POOLS_ACCOUNT,
} from "@/constants/pools";
import { getDb } from "@/lib/db";
import { getPackModel } from "@/models/Pack";
import { adminDeletePack, setPackHidden } from "@/services/moderation";
import { runPoolsStatsBackfill } from "@/services/pack-stats";
import { createPack } from "@/services/packs";
import { tombstoneOrigin } from "@/services/pools-sync";
import { buildSearchIndex } from "@/services/public-packs";
import { flushAfter } from "../../../helpers/after";
import { freezeTime } from "../../../helpers/api-key";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/requests";
import { setupStatsLookups } from "../../../helpers/stats-lookups";

setupTestDb();
setupStatsLookups();

const TOKEN = "pools-service-token-for-tests-0123456789";
const REF = "otdb-58";
const BODY: PackInput = {
  name: "Ricma 2 Quarterfinals",
  visibility: "public",
  slots: [{ mod: "NM", index: 1, beatmapId: 101 }],
};

type Call = {
  ref?: string;
  token?: string | null;
  ip?: string;
  headers?: Record<string, string>;
  body?: PackInput;
};

const request = (method: "PUT" | "DELETE", call: Call) => {
  const { ref = REF, token = TOKEN, ip = "203.0.113.7", headers = {}, body = BODY } = call;
  return apiRequest(`/api/service/pools/${ref}`, {
    method,
    ...(method === "PUT" ? { body } : {}),
    headers: {
      "x-real-ip": ip,
      ...(token === null ? {} : { authorization: `Bearer ${token}` }),
      ...headers,
    },
  });
};
const context = (call: Call) => ({ params: Promise.resolve({ ref: call.ref ?? REF }) });

type Answer = { slug: string; state: string; listed: boolean };

/** Publishes the pool through the PUT, as pools does. */
const publish = async (call: Call = {}) => {
  const response = await PUT(request("PUT", call), context(call));
  return { status: response.status, ...((await response.json()) as Answer) };
};
const remove = (call: Call = {}) => DELETE(request("DELETE", call), context(call));

const codeOf = async (response: Response): Promise<string> =>
  ((await response.json()) as { error: { code: string } }).error.code;
const packCount = () => getPackModel().countDocuments({});
const tombstones = () => getDb().collection<{ _id: string }>(DELETED_ORIGINS_COLLECTION);
const markers = () =>
  getDb().collection<{ originId: string; hiddenAt: Date }>(HIDDEN_ORIGINS_COLLECTION);
const moderator = () => new ObjectId().toHexString();
const hiddenAtOf = async (slug: string) =>
  (await getPackModel().findOne({ slug }).lean())?.hiddenAt ?? null;
const paths = () => vi.mocked(revalidatePath).mock.calls.map(([path]) => path);

beforeEach(() => {
  vi.stubEnv("POOLS_SERVICE_TOKEN", TOKEN);
  vi.mocked(revalidatePath).mockClear();
});
afterEach(() => {
  // Not vi.unstubAllEnvs(): the integration setup stubs the server env (MONGODB_URI) too.
  vi.stubEnv("POOLS_SERVICE_TOKEN", "");
  vi.useRealTimers();
});

describe("DELETE /api/service/pools/{ref}: the token", () => {
  it("refuses everything while POOLS_SERVICE_TOKEN is unset or short, and deletes nothing", async () => {
    await publish();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const configured of ["", "a".repeat(31)]) {
      vi.stubEnv("POOLS_SERVICE_TOKEN", configured);
      const response = await remove({ token: configured || TOKEN });
      expect(response.status).toBe(503);
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(await codeOf(response)).toBe("not_configured");
    }
    error.mockRestore();
    expect(await packCount()).toBe(1);
  });

  it.each([
    ["no token", null],
    ["a short token", TOKEN.slice(0, 16)],
    ["a wrong token", "not-the-pools-token-at-all-000000000"],
  ])("answers 401 to %s, never cached, and deletes nothing", async (_label, token) => {
    await publish();
    vi.mocked(revalidatePath).mockClear();
    const response = await remove({ token });
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await packCount()).toBe(1);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("answers 429 once one IP failed too often, and the right token still gets through", async () => {
    freezeTime();
    await publish();
    for (let i = 0; i < RATE_LIMITS.serviceAuthFail.limit; i++) {
      expect((await remove({ token: "wrong", ip: "198.51.100.4" })).status).toBe(401);
    }
    const limited = await remove({ token: "wrong", ip: "198.51.100.4" });
    expect(limited.status).toBe(429);
    expect(limited.headers.get("cache-control")).toBe("no-store");
    expect(await packCount()).toBe(1);
    expect((await remove({ ip: "198.51.100.4" })).status).toBe(204);
  });

  it("reads no cookies, so a cross-site request with the token still works", async () => {
    await publish();
    const response = await remove({
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(response.status).toBe(204);
  });
});

describe("DELETE /api/service/pools/{ref}: the ref", () => {
  it.each(["OTDB-58", "otdb_58", "a".repeat(65)])("answers 400 to the ref %j", async (ref) => {
    await publish();
    const response = await remove({ ref });
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await packCount()).toBe(1);
  });
});

describe("DELETE /api/service/pools/{ref}: answers", () => {
  it("deletes the pool's pack and answers 204 with no body, never cached", async () => {
    const { slug } = await publish();
    const response = await remove();
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).toBe("");
    expect(await getPackModel().findOne({ slug }).lean()).toBeNull();
  });

  it("deletes an unlisted pack, and one a moderator hid", async () => {
    await publish({ body: { ...BODY, visibility: "unlisted" } });
    expect((await remove()).status).toBe(204);
    const { slug } = await publish();
    await setPackHidden(slug, new ObjectId().toHexString(), true);
    expect((await remove()).status).toBe(204);
    expect(await packCount()).toBe(0);
  });

  it("marks the pack page, /packs, the index, the homepage and the sitemap stale", async () => {
    const { slug } = await publish();
    vi.mocked(revalidatePath).mockClear();
    await remove();
    expect(revalidatePath).toHaveBeenCalledWith("/(public)/packs", "layout");
    for (const path of ["/packs/index.json", "/", "/sitemap.xml", `/p/${slug}`]) {
      expect(revalidatePath).toHaveBeenCalledWith(path);
    }
  });

  it("answers 404 not_found when the pool has no pack, and marks nothing stale", async () => {
    const response = await remove();
    expect(response.status).toBe(404);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await codeOf(response)).toBe("not_found");
    expect(paths()).toEqual([]);
    // Never creates the pools account, unlike a sync.
    expect(await getDb().collection("user").countDocuments({})).toBe(0);
    await publish();
    expect((await remove()).status).toBe(204);
    vi.mocked(revalidatePath).mockClear();
    expect((await remove()).status).toBe(404);
    expect(paths()).toEqual([]);
  });

  it("deletes only that pool's pack: another pool's and the account's other packs stay", async () => {
    const other = await publish({ ref: "otdb-59" });
    const plain = await createPack(
      POOLS_ACCOUNT.id,
      { ...BODY, name: "No origin" },
      {
        unlimited: true,
      },
    );
    const { slug } = await publish();
    expect((await remove()).status).toBe(204);
    const left = await getPackModel().find({}).lean();
    expect(left.map((doc) => doc.slug).sort()).toEqual([other.slug, plain.slug].sort());
    expect(left.map((doc) => doc.slug)).not.toContain(slug);
  });

  it.each([
    ["another owner's pack", "player", "pools"],
    ["a pools account pack of another origin kind", "pools", "other"],
  ])("answers 404 to %s with that origin id, and leaves it", async (_label, owner, kind) => {
    await publish({ ref: "otdb-1" }); // makes the pools account
    const ownerId = owner === "pools" ? POOLS_ACCOUNT.id : (await createTestUser()).id;
    const { slug } = await createPack(ownerId, BODY, {
      unlimited: true,
      origin: { kind, id: REF },
    });
    vi.mocked(revalidatePath).mockClear();
    const response = await remove();
    expect(response.status).toBe(404);
    expect(await getPackModel().countDocuments({ slug })).toBe(1);
    expect(paths()).toEqual([]);
  });
});

describe("DELETE /api/service/pools/{ref}: tombstones", () => {
  it("answers 410 gone for a pool whose pack a moderator deleted, and does nothing", async () => {
    const { slug } = await publish();
    expect(await adminDeletePack(slug)).toBe(true);
    vi.mocked(revalidatePath).mockClear();
    const response = await remove();
    expect(response.status).toBe(410);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await codeOf(response)).toBe("gone");
    expect(await tombstones().countDocuments({ _id: REF })).toBe(1);
    expect(paths()).toEqual([]);
  });

  it("answers 410 and leaves the pack while a moderator's delete is between its two writes", async () => {
    const { slug } = await publish();
    await tombstoneOrigin(REF);
    expect((await remove()).status).toBe(410);
    expect(await getPackModel().countDocuments({ slug })).toBe(1);
  });

  it("writes no tombstone, so a later PUT creates the pool's pack again", async () => {
    const first = await publish();
    expect((await remove()).status).toBe(204);
    expect(await tombstones().countDocuments({})).toBe(0);
    const again = await publish();
    expect(again.status).toBe(201);
    expect(again.slug).not.toBe(first.slug);
    const doc = await getPackModel().findOne({ slug: again.slug }).lean();
    expect(doc?.origin).toEqual({ kind: "pools", id: REF });
    expect(doc?.ownerId.toString()).toBe(POOLS_ACCOUNT.id);
  });

  it("stays deleted once the stats job its save scheduled runs, and leaves the backfill nothing", async () => {
    await publish();
    expect((await remove()).status).toBe(204);
    await flushAfter();
    expect(await packCount()).toBe(0);
    expect(await runPoolsStatsBackfill()).toEqual({ updated: 0, remaining: 0 });
  });
});

describe("DELETE /api/service/pools/{ref}: a moderator's hide", () => {
  it("is remembered: the PUT after a delete creates the pack hidden and keeps the marker", async () => {
    const first = await publish();
    await setPackHidden(first.slug, moderator(), true);
    const hiddenAt = await hiddenAtOf(first.slug);
    expect(hiddenAt).toBeInstanceOf(Date);
    expect((await remove()).status).toBe(204);
    expect(await markers().find({}).toArray()).toEqual([
      { _id: expect.anything(), originId: REF, hiddenAt },
    ]);
    const again = await publish();
    expect(again).toMatchObject({ status: 201, state: "created", listed: false });
    expect(await hiddenAtOf(again.slug)).toEqual(hiddenAt);
    expect((await buildSearchIndex()).packs.map((entry) => entry.s)).not.toContain(again.slug);
    expect(await markers().countDocuments({ originId: REF })).toBe(1);
    // Still hidden through an update, and a second delete keeps the one marker.
    expect(await publish({ body: { ...BODY, name: "Renamed" } })).toMatchObject({
      state: "updated",
      listed: false,
    });
    expect((await remove()).status).toBe(204);
    expect(await markers().countDocuments({})).toBe(1);
  });

  it("is forgotten on an unhide, so the pack after the next delete comes back listed", async () => {
    const first = await publish();
    await setPackHidden(first.slug, moderator(), true);
    await remove();
    const hidden = await publish();
    expect(hidden.listed).toBe(false);
    await setPackHidden(hidden.slug, moderator(), false);
    expect(await markers().countDocuments({})).toBe(0);
    expect((await remove()).status).toBe(204);
    expect(await markers().countDocuments({})).toBe(0);
    const listed = await publish();
    expect(listed).toMatchObject({ status: 201, listed: true });
    expect(await hiddenAtOf(listed.slug)).toBeNull();
  });

  it("isn't written when the pack wasn't hidden, and a stale one goes", async () => {
    await publish();
    expect((await remove()).status).toBe(204);
    expect(await markers().countDocuments({})).toBe(0);
    await publish();
    // Left by an unhide that failed after its write: the pack is visible, so the marker is wrong.
    await markers().insertOne({ originId: REF, hiddenAt: new Date() });
    expect((await remove()).status).toBe(204);
    expect(await markers().countDocuments({})).toBe(0);
    expect((await publish()).listed).toBe(true);
  });

  it("leaves no marker behind a 404 or a 410", async () => {
    expect((await remove()).status).toBe(404);
    const { slug } = await publish();
    await setPackHidden(slug, moderator(), true);
    await adminDeletePack(slug);
    expect((await remove()).status).toBe(410);
    expect(await markers().countDocuments({})).toBe(0);
  });
});
