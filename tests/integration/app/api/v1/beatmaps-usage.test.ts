/**
 * @file tests/integration/app/api/v1/beatmaps-usage.test.ts
 * @desc GET /api/v1/beatmaps/{id}/usage and GET /api/v1/beatmaps/usage: no key needed, the
 *       answer's shape (entries most recent year first, count of pools, 0 and no entries for an
 *       unused map), ids in the order asked and each once, up to MAX_USAGE_IDS, 400 for bad ids,
 *       CDN caching on answers and never on errors, no CORS or rate-limit headers on a cached
 *       answer, and the per-IP limit shared by both routes (429 with Retry-After).
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getOne } from "@/app/api/v1/beatmaps/[id]/usage/route";
import { GET as getMany } from "@/app/api/v1/beatmaps/usage/route";
import { RATE_LIMITS } from "@/constants/api";
import { MAP_USAGE_CACHE, MAX_USAGE_IDS } from "@/constants/map-usage";
import { RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { BAD_USAGE_ID, BAD_USAGE_IDS } from "@/lib/api";
import { getDb } from "@/lib/db";
import { rateLimitId, windowFor } from "@/lib/rate-limit";
import { beatmapUsageListSchema, beatmapUsageSchema } from "@/schemas/map-usage";
import { applyArchivePlan, ensureArchiveAccount } from "@/services/archive";
import { rebuildMapUsage } from "@/services/map-usage";
import { planArchiveImport } from "@/utils/archive-import";
import { normalizePool } from "@/utils/archive-pools";
import { otdbSource } from "@/utils/otdb";
import { freezeTime } from "../../../../helpers/api-key";
import { setupTestDb } from "../../../../helpers/db";
import { apiRequest, noContext } from "../../../../helpers/requests";

setupTestDb();
beforeEach(() => freezeTime());
afterEach(() => vi.useRealTimers());

const NOW = new Date("2026-09-24T12:00:00.000Z");
const IP = "203.0.113.9";

const one = (id: string, ip = IP) =>
  getOne(apiRequest(`/api/v1/beatmaps/${id}/usage`, { headers: { "x-real-ip": ip } }), {
    params: Promise.resolve({ id }),
  });

const many = (query: string, ip = IP) =>
  getMany(
    apiRequest(`/api/v1/beatmaps/usage${query}`, { headers: { "x-real-ip": ip } }),
    noContext,
  );

/** Two archive pools that share map 75, and usage built from them. */
const seed = async () => {
  const ownerId = await ensureArchiveAccount(NOW);
  const pools = [
    {
      id: 1,
      name: "Spring Cup 2023 Finals",
      slots: [
        ["NM1", 75],
        ["HD1", 76],
      ],
    },
    {
      id: 2,
      name: "Autumn Cup 2025 Semifinals",
      slots: [
        ["NM1", 75],
        ["TB", 75],
      ],
    },
  ] as const;
  for (const { id, name, slots } of pools) {
    const normalized = normalizePool(
      {
        source: otdbSource(id),
        name,
        slots: slots.map(([label, beatmapId]) => ({ label, beatmapId })),
      },
      new Map(),
      NOW,
    );
    if (!normalized.ok) throw new Error(normalized.skipped.reason);
    await applyArchivePlan(planArchiveImport([normalized.pool], [], []), {
      ownerId,
      now: NOW,
      makeSlug: () => String(id).padStart(10, "a"),
    });
  }
  await rebuildMapUsage(undefined, NOW);
};

const expectCached = (response: Response) => {
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe(MAP_USAGE_CACHE);
  expect(response.headers.get("ratelimit-remaining")).toBeNull();
  expect(response.headers.get("access-control-allow-origin")).toBeNull();
};

const expectBadRequest = async (response: Response, message: string) => {
  expect(response.status).toBe(400);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.json()).toEqual({ error: { code: "bad_request", message } });
};

describe("GET /api/v1/beatmaps/{id}/usage", () => {
  it("answers without a key: entries most recent year first and a count of pools", async () => {
    await seed();
    const response = await one("75");
    expectCached(response);
    const body = beatmapUsageSchema.parse(await response.json());
    expect(body.beatmapId).toBe(75);
    expect(body.count).toBe(2);
    expect(body.entries.map((entry) => [entry.slug, entry.year, entry.slot, entry.mods])).toEqual([
      ["aaaaaaaaa2", 2025, "NM1", "NM"],
      ["aaaaaaaaa2", 2025, "TB1", "TB"],
      ["aaaaaaaaa1", 2023, "NM1", "NM"],
    ]);
    expect(body.entries[0]).toEqual({
      slug: "aaaaaaaaa2",
      tournament: "Autumn Cup 2025",
      round: "Semifinals",
      year: 2025,
      badged: null,
      slot: "NM1",
      mods: "NM",
      fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    const [first, second] = body.entries;
    // One pool, one fingerprint: the same as the pack's archive.fingerprint.
    expect(first?.fingerprint).toBe(second?.fingerprint);
    expect(first?.fingerprint).not.toBe(body.entries[2]?.fingerprint);
  });

  it("answers a map no archive pool used with a count of 0, never a 404", async () => {
    const response = await one("129891");
    expectCached(response);
    expect(await response.json()).toEqual({ beatmapId: 129891, count: 0, entries: [] });
  });

  it.each(["abc", "0", "-1", "1.5", "2147483648", "75 "])("refuses %j with 400", async (id) => {
    await expectBadRequest(await one(id), BAD_USAGE_ID);
  });
});

describe("GET /api/v1/beatmaps/usage", () => {
  it("answers each id once, in the order asked", async () => {
    await seed();
    const response = await many("?ids=76,129891,75,76");
    expectCached(response);
    const { beatmaps } = beatmapUsageListSchema.parse(await response.json());
    expect(beatmaps.map((usage) => [usage.beatmapId, usage.count, usage.entries.length])).toEqual([
      [76, 1, 1],
      [129891, 0, 0],
      [75, 2, 3],
    ]);
  });

  it(`takes ${MAX_USAGE_IDS} ids`, async () => {
    const ids = Array.from({ length: MAX_USAGE_IDS }, (_, i) => i + 1);
    const response = await many(`?ids=${ids.join(",")}`);
    expectCached(response);
    const { beatmaps } = beatmapUsageListSchema.parse(await response.json());
    expect(beatmaps.map((usage) => usage.beatmapId)).toEqual(ids);
  });

  it.each([
    ["no ids", ""],
    ["an empty list", "?ids="],
    ["a bad id", "?ids=75,abc"],
    ["a zero", "?ids=0"],
    [
      "too many ids",
      `?ids=${Array.from({ length: MAX_USAGE_IDS + 1 }, (_, i) => i + 1).join(",")}`,
    ],
  ])("refuses %s with 400", async (_label, query) => {
    await expectBadRequest(await many(query), BAD_USAGE_IDS);
  });
});

describe("the per-IP limit on map usage", () => {
  const rule = RATE_LIMITS.mapUsage;

  it("counts both routes against one counter per IP", async () => {
    await one("75");
    await many("?ids=75");
    const counter = await getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: rateLimitId(rule, IP, Date.now()) });
    expect(counter?.count).toBe(2);
  });

  it("answers 429 with Retry-After past the limit, never cached, other IPs unaffected", async () => {
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertOne({
        _id: rateLimitId(rule, IP, Date.now()),
        count: rule.limit,
        expiresAt: windowFor(rule, Date.now()).expiresAt,
      });
    for (const refused of [await one("75"), await many("?ids=75")]) {
      expect(refused.status).toBe(429);
      expect(refused.headers.get("retry-after")).toBe("50");
      expect(refused.headers.get("ratelimit-limit")).toBe(String(rule.limit));
      expect(refused.headers.get("ratelimit-remaining")).toBe("0");
      expect(refused.headers.get("cache-control")).toBe("no-store");
      expect(((await refused.json()) as { error: { code: string } }).error.code).toBe(
        "rate_limited",
      );
    }
    expectCached(await one("75", "198.51.100.7"));
  });

  it(`allows ${RATE_LIMITS.mapUsage.limit} requests a minute`, () => {
    expect(rule).toEqual({ scope: "map-usage", limit: 60, windowSeconds: 60 });
  });
});
