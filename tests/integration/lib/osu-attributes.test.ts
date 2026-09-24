/**
 * @file tests/integration/lib/osu-attributes.test.ts
 * @desc Star ratings with mods on the server: the Mongo cache (hits skip osu!), write-back, the
 *       per-request cap and concurrency, the shuffled selection of misses, the global osu! budget
 *       across requests and minutes (and no more counting once it refuses), osu! refusing a pair,
 *       osu! failing, and the database being unreachable; the per-subject share of the budget.
 *       osu! is MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { createOsuClient } from "@haruhimemoe/osu";
import type { ModAcronym } from "@haruhimemoe/pool";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  MAX_OSU_FETCHES_PER_REQUEST,
  OSU_API_BUDGET,
  OSU_API_BUDGET_PER_IP,
  OSU_FETCH_CONCURRENCY,
  RATE_LIMITS_COLLECTION,
  STAR_RATINGS_COLLECTION,
  type StarPair,
} from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import {
  getStarRatings,
  osuBudgetWindow,
  osuSubjectWindow,
  takeOsuBudget,
} from "@/lib/osu/attributes";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

const NOW = Date.parse("2026-09-22T12:00:10.250Z");
let calls: string[] = [];
let active = 0;
let peak = 0;
let delayMs = 0;

const server = setupServer(
  http.post("https://osu.ppy.sh/oauth/token", () =>
    HttpResponse.json({ token_type: "Bearer", expires_in: 86400, access_token: "t" }),
  ),
  http.post("https://osu.ppy.sh/api/v2/beatmaps/:id/attributes", async ({ params, request }) => {
    const { mods } = (await request.json()) as { mods: string[] };
    calls.push(`${String(params.id)}:${mods.join("")}`);
    active++;
    peak = Math.max(peak, active);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    active--;
    if (params.id === "404") return new HttpResponse(null, { status: 404 });
    if (params.id === "500") return new HttpResponse(null, { status: 500 });
    // A distinct rating per pair: the id plus a tenth per mod.
    return HttpResponse.json({ attributes: { star_rating: Number(params.id) + mods.length / 10 } });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  calls = [];
  active = 0;
  peak = 0;
  delayMs = 0;
});

const pair = (beatmapId: number, ...set: ModAcronym[]): StarPair => ({
  key: `${beatmapId}:${set.join("")}`,
  beatmapId,
  set,
});
const deps = (now = NOW) => ({
  osu: createOsuClient({
    userAgent: "packs-test",
    credentials: () => ({ clientId: "1", clientSecret: "s" }),
  }),
  now: () => now,
});
/** mulberry32: a tiny seeded generator, so the shuffled selection is repeatable. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const stars = () =>
  getDb().collection<{ _id: string; stars: number; fetchedAt: Date }>(STAR_RATINGS_COLLECTION);
const counters = () =>
  getDb().collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION);

describe("getStarRatings", () => {
  it("fetches misses from osu!, caches them, and returns them", async () => {
    const result = await getStarRatings([pair(7, "HD"), pair(7, "HD", "HR")], deps());
    expect(result).toEqual({ ratings: { "7:HD": 7.1, "7:HDHR": 7.2 }, pending: [] });
    expect(await stars().findOne({ _id: "7:HDHR" })).toEqual({
      _id: "7:HDHR",
      stars: 7.2,
      fetchedAt: new Date(NOW),
    });
  });

  it("answers from the cache without calling osu!", async () => {
    await stars().insertOne({ _id: "7:HD", stars: 9.99, fetchedAt: new Date(NOW) });
    expect(await getStarRatings([pair(7, "HD")], deps())).toEqual({
      ratings: { "7:HD": 9.99 },
      pending: [],
    });
    expect(calls).toEqual([]);
  });

  it(`calls osu! at most ${MAX_OSU_FETCHES_PER_REQUEST} times per request, the rest pending`, async () => {
    const pairs = Array.from({ length: 25 }, (_, i) => pair(i + 1, "HD"));
    const result = await getStarRatings(pairs, deps());
    expect(calls).toHaveLength(20);
    expect(Object.keys(result.ratings)).toHaveLength(20);
    expect(result.pending).toHaveLength(5);
    expect([...Object.keys(result.ratings), ...result.pending].sort()).toEqual(
      pairs.map((p) => p.key).sort(),
    );
  });

  it("fetches a shuffled 20 of the misses, so viewers of one new pool spread out", async () => {
    const pairs = Array.from({ length: 25 }, (_, i) => pair(i + 1, "HD"));
    const result = await getStarRatings(pairs, { ...deps(), random: seeded(3) });
    const fetched = Object.keys(result.ratings);
    expect(calls).toHaveLength(MAX_OSU_FETCHES_PER_REQUEST);
    expect(new Set(calls).size).toBe(MAX_OSU_FETCHES_PER_REQUEST);
    expect(fetched.sort()).not.toEqual(
      pairs
        .slice(0, 20)
        .map((p) => p.key)
        .sort(),
    );
    // Pending stays in request order: every pair that wasn't fetched.
    expect(result.pending).toEqual(
      pairs.map((p) => p.key).filter((key) => result.ratings[key] === undefined),
    );
    // Same random sequence, same selection.
    calls = [];
    await stars().deleteMany({});
    await counters().deleteMany({});
    const again = await getStarRatings(pairs, { ...deps(), random: seeded(3) });
    expect(again.pending).toEqual(result.pending);
  });

  it("keeps at most 4 osu! calls in flight", async () => {
    delayMs = 5;
    await getStarRatings(
      Array.from({ length: 10 }, (_, i) => pair(i + 1, "DT")),
      deps(),
    );
    expect(peak).toBe(4);
  });

  it("stops at 50 osu! calls a minute across requests, and starts again next minute", async () => {
    const batch = (from: number) => Array.from({ length: 20 }, (_, i) => pair(from + i, "HR"));
    await getStarRatings(batch(100), deps());
    await getStarRatings(batch(200), deps());
    const third = await getStarRatings(batch(300), deps());
    expect(calls).toHaveLength(OSU_API_BUDGET.limit);
    expect(third.pending).toHaveLength(10);
    const nextMinute = await getStarRatings(batch(300), deps(NOW + 60_000));
    expect(nextMinute.pending).toEqual([]);
  });

  it("calls nothing when the budget is already spent", async () => {
    const { id, expiresAt } = osuBudgetWindow(NOW);
    await counters().insertOne({ _id: id, count: OSU_API_BUDGET.limit, expiresAt });
    const result = await getStarRatings([pair(7, "HD")], deps());
    expect(result).toEqual({ ratings: {}, pending: ["7:HD"] });
    expect(calls).toEqual([]);
  });

  it("stops counting against the budget for the rest of a request once it's refused", async () => {
    const { id, expiresAt } = osuBudgetWindow(NOW);
    await counters().insertOne({ _id: id, count: OSU_API_BUDGET.limit - 2, expiresAt });
    const pairs = Array.from({ length: 20 }, (_, i) => pair(i + 1, "HD"));
    const result = await getStarRatings(pairs, deps());
    expect(calls).toHaveLength(2);
    expect(result.pending).toHaveLength(18);
    // Only the first round of workers (already in flight when the refusal lands) counts.
    const count = (await counters().findOne({ _id: id }))?.count ?? 0;
    expect(count).toBeLessThanOrEqual(OSU_API_BUDGET.limit - 2 + OSU_FETCH_CONCURRENCY);
  });

  it("takes the spent budget once per worker, not once per pair", async () => {
    const { id, expiresAt } = osuBudgetWindow(NOW);
    await counters().insertOne({ _id: id, count: OSU_API_BUDGET.limit, expiresAt });
    const pairs = Array.from({ length: 20 }, (_, i) => pair(i + 1, "HD"));
    const result = await getStarRatings(pairs, deps());
    expect(calls).toEqual([]);
    expect(result.pending).toEqual(pairs.map((p) => p.key));
    const count = (await counters().findOne({ _id: id }))?.count ?? 0;
    expect(count).toBeLessThanOrEqual(OSU_API_BUDGET.limit + OSU_FETCH_CONCURRENCY);
  });

  it("leaves out a pair osu! refuses, serves the rest, and caches nothing for it", async () => {
    const result = await getStarRatings([pair(404, "HD"), pair(7, "HD")], deps());
    expect(result).toEqual({ ratings: { "7:HD": 7.1 }, pending: [] });
    expect(await stars().findOne({ _id: "404:HD" })).toBeNull();
  });

  it("marks a pair pending when osu! fails", async () => {
    const result = await getStarRatings([pair(500, "HD"), pair(7, "HD")], deps());
    expect(result).toEqual({ ratings: { "7:HD": 7.1 }, pending: ["500:HD"] });
    expect(await stars().findOne({ _id: "500:HD" })).toBeNull();
  });

  it("marks everything pending, without calling osu!, when the database is unreachable", async () => {
    const result = await getStarRatings([pair(7, "HD")], {
      ...deps(),
      db: () => Promise.reject(new Error("no route to Atlas")),
    });
    expect(result).toEqual({ ratings: {}, pending: ["7:HD"] });
    expect(calls).toEqual([]);
  });
});

describe("osu! budget window", () => {
  it("uses the rate-limit id shape scope:subject:windowStartSeconds and a minute of grace", () => {
    expect(osuBudgetWindow(NOW)).toEqual({
      id: `osu-api:global:${Date.parse("2026-09-22T12:00:00.000Z") / 1000}`,
      expiresAt: new Date("2026-09-22T12:02:00.000Z"),
    });
  });

  it("counts every call in the window", async () => {
    for (let i = 0; i < OSU_API_BUDGET.limit; i++)
      expect(await takeOsuBudget(getDb(), NOW)).toBe(true);
    expect(await takeOsuBudget(getDb(), NOW)).toBe(false);
    expect((await counters().findOne({ _id: osuBudgetWindow(NOW).id }))?.count).toBe(51);
  });
});

describe("per-subject share of the osu! budget", () => {
  it("uses the id shape osu-api-ip:subject:windowStartSeconds and a minute of grace", () => {
    expect(osuSubjectWindow("203.0.113.9", NOW)).toEqual({
      id: `osu-api-ip:203.0.113.9:${Date.parse("2026-09-22T12:00:00.000Z") / 1000}`,
      expiresAt: new Date("2026-09-22T12:02:00.000Z"),
    });
  });

  it("refuses a subject past its share without touching the global counter", async () => {
    for (let i = 0; i < OSU_API_BUDGET_PER_IP.limit; i++)
      expect(await takeOsuBudget(getDb(), NOW, "203.0.113.9")).toBe(true);
    expect(await takeOsuBudget(getDb(), NOW, "203.0.113.9")).toBe(false);
    expect((await counters().findOne({ _id: osuBudgetWindow(NOW).id }))?.count).toBe(20);
    expect(await takeOsuBudget(getDb(), NOW, "198.51.100.7")).toBe(true);
    expect((await counters().findOne({ _id: osuBudgetWindow(NOW).id }))?.count).toBe(21);
  });

  it("still refuses when the global budget is spent, even with share left", async () => {
    const { id, expiresAt } = osuBudgetWindow(NOW);
    await counters().insertOne({ _id: id, count: OSU_API_BUDGET.limit, expiresAt });
    expect(await takeOsuBudget(getDb(), NOW, "203.0.113.9")).toBe(false);
  });

  it("stops getStarRatings calling osu! once the subject's share is spent", async () => {
    const pairs = Array.from({ length: 25 }, (_, i) => pair(i + 1, "HD"));
    const first = await getStarRatings(pairs.slice(0, 20), { ...deps(), subject: "203.0.113.9" });
    expect(first.pending).toEqual([]);
    const second = await getStarRatings(pairs.slice(20), { ...deps(), subject: "203.0.113.9" });
    expect(second.pending).toHaveLength(5);
    expect(calls).toHaveLength(20);
  });
});
