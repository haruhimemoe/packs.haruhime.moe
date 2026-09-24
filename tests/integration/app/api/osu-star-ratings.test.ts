/**
 * @file tests/integration/app/api/osu-star-ratings.test.ts
 * @desc GET /api/osu/star-ratings through the real handler, in-memory Mongo, MSW osu!: answers,
 *       the cache, the CDN header only for complete answers, partial answers when osu! fails or
 *       the budget is spent, the per-request cap, bad or overlong queries, the per-IP request
 *       limit (429 with Retry-After), and the per-IP share of osu! calls (IPv6 by its /64).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/osu/star-ratings/route";
import { RATE_LIMITS } from "@/constants/api";
import {
  MAX_STAR_QUERY_LENGTH,
  OSU_API_BUDGET,
  OSU_API_BUDGET_PER_IP,
  OSU_FETCH_CONCURRENCY,
  RATE_LIMITS_COLLECTION,
} from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { osuBudgetWindow, osuSubjectWindow } from "@/lib/osu/attributes";
import { rateLimitId, windowFor } from "@/lib/rate-limit";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();

const CDN = "public, s-maxage=86400, stale-while-revalidate=604800";
let calls = 0;
let failing = false;

const server = setupServer(
  http.post("https://osu.ppy.sh/oauth/token", () =>
    HttpResponse.json({ token_type: "Bearer", expires_in: 86400, access_token: "t" }),
  ),
  http.post("https://osu.ppy.sh/api/v2/beatmaps/:id/attributes", async ({ params, request }) => {
    calls++;
    if (failing) return new HttpResponse(null, { status: 503 });
    const { mods } = (await request.json()) as { mods: string[] };
    return HttpResponse.json({ attributes: { star_rating: Number(params.id) + mods.length / 10 } });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());
beforeEach(() => {
  calls = 0;
  failing = false;
  // Only Date is faked: the budget window must not roll over mid-test.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-22T12:00:10.000Z"));
});

const call = (q: string) => GET(new Request(`http://localhost:3000/api/osu/star-ratings?q=${q}`));

describe("GET /api/osu/star-ratings", () => {
  it("answers every pair and lets the CDN keep it", async () => {
    const response = await call("7:HD,7:HDHR");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe(CDN);
    expect(await response.json()).toEqual({ ratings: { "7:HD": 7.1, "7:HDHR": 7.2 }, pending: [] });
  });

  it("serves a repeat from the cache without calling osu!", async () => {
    await call("7:HD");
    const before = calls;
    const response = await call("7:HD");
    expect(response.headers.get("cache-control")).toBe(CDN);
    expect(await response.json()).toEqual({ ratings: { "7:HD": 7.1 }, pending: [] });
    expect(calls).toBe(before);
  });

  it("answers what it can and marks the rest pending when osu! is down, never cached", async () => {
    await call("7:HD");
    failing = true;
    const response = await call("7:HD,8:HD");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ratings: { "7:HD": 7.1 }, pending: ["8:HD"] });
  });

  it("marks pairs pending when the osu! budget is spent", async () => {
    const { id, expiresAt } = osuBudgetWindow(Date.now());
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertOne({ _id: id, count: OSU_API_BUDGET.limit, expiresAt });
    const response = await call("7:HD");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ratings: {}, pending: ["7:HD"] });
    expect(calls).toBe(0);
  });

  it("fetches at most 20 pairs per request (a random 20), the other one pending", async () => {
    const q = Array.from({ length: 21 }, (_, i) => `${i + 1}:HD`).join(",");
    const body = (await (await call(q)).json()) as { pending: string[] };
    expect(calls).toBe(20);
    expect(body.pending).toHaveLength(1);
  });

  it.each(["", "q", "129891:DTHD", "129891:", "0:HD", "129891:NC"])("rejects q=%j", async (q) => {
    const response = await call(q);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "bad_request", message: "Pass 1 to 320 pairs like ?q=129891:HD,129891:HDHR." },
    });
    expect(calls).toBe(0);
  });

  it("rejects an overlong q with 400", async () => {
    const response = await call("7:HD,".repeat(MAX_STAR_QUERY_LENGTH));
    expect(response.status).toBe(400);
    expect(calls).toBe(0);
  });

  it("rejects a missing q", async () => {
    const response = await GET(new Request("http://localhost:3000/api/osu/star-ratings"));
    expect(response.status).toBe(400);
  });
});

describe("GET /api/osu/star-ratings per-IP limit", () => {
  const rule = RATE_LIMITS.osuStarRatings;
  const from = (ip: string) =>
    GET(
      new Request("http://localhost:3000/api/osu/star-ratings?q=7:HD", {
        headers: { "x-real-ip": ip },
      }),
    );
  const counter = (ip: string) =>
    getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: rateLimitId(rule, ip, Date.now()) });

  it("counts each request against the caller's IP", async () => {
    await from("203.0.113.9");
    await from("203.0.113.9");
    expect((await counter("203.0.113.9"))?.count).toBe(2);
  });

  it("answers 429 with Retry-After past the limit, without calling osu!, other IPs unaffected", async () => {
    await getDb()
      .collection<{ _id: string; count: number; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
      .insertOne({
        _id: rateLimitId(rule, "203.0.113.9", Date.now()),
        count: rule.limit,
        expiresAt: windowFor(rule, Date.now()).expiresAt,
      });
    const refused = await from("203.0.113.9");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("retry-after")).toBe("50");
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect((await refused.json()).error.code).toBe("rate_limited");
    expect(calls).toBe(0);
    expect((await from("203.0.113.10")).status).toBe(200);
  });
});

describe("GET /api/osu/star-ratings per-IP share of osu! calls", () => {
  /** Asks for `count` pairs no earlier request has asked for, from `ip`. */
  let next = 1;
  const fresh = (ip: string, count: number) => {
    const q = Array.from({ length: count }, () => `${next++}:HD`).join(",");
    return GET(
      new Request(`http://localhost:3000/api/osu/star-ratings?q=${q}`, {
        headers: { "x-real-ip": ip },
      }),
    );
  };
  const global = () =>
    getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: osuBudgetWindow(Date.now()).id });

  it("allows one IP 20 osu! calls a minute, then answers pending; another IP still gets calls", async () => {
    expect(OSU_API_BUDGET_PER_IP.limit).toBe(20);
    await fresh("203.0.113.9", 20);
    expect(calls).toBe(20);
    const refused = (await (await fresh("203.0.113.9", 5)).json()) as { pending: string[] };
    expect(calls).toBe(20);
    expect(refused.pending).toHaveLength(5);
    expect((await global())?.count).toBe(20);
    await fresh("198.51.100.7", 5);
    expect(calls).toBe(25);
    expect((await global())?.count).toBe(25);
  });

  it("never lets one IP take the global counter past 20, however many requests it sends", async () => {
    for (let i = 0; i < 4; i++) await fresh("203.0.113.9", 20);
    expect(calls).toBe(20);
    expect((await global())?.count).toBe(20);
  });

  it("counts two addresses in one IPv6 /64 as one caller", async () => {
    await fresh("2001:db8:1:2::1", 20);
    expect(calls).toBe(20);
    await fresh("2001:db8:1:2:ffff::9", 5);
    expect(calls).toBe(20);
    await fresh("2001:db8:1:3::1", 5);
    expect(calls).toBe(25);
    const subject = await getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: osuSubjectWindow("2001:db8:1:2::/64", Date.now()).id });
    // 20 served, then refused tries: up to OSU_FETCH_CONCURRENCY run before the first refusal
    // lands, and after it the request stops counting.
    expect(subject?.count).toBeGreaterThan(OSU_API_BUDGET_PER_IP.limit);
    expect(subject?.count).toBeLessThanOrEqual(OSU_API_BUDGET_PER_IP.limit + OSU_FETCH_CONCURRENCY);
  });

  it("counts the request limit by /64 too", async () => {
    await fresh("2001:db8:1:2::1", 1);
    await fresh("2001:db8:1:2::2", 1);
    const counted = await getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: rateLimitId(RATE_LIMITS.osuStarRatings, "2001:db8:1:2::/64", Date.now()) });
    expect(counted?.count).toBe(2);
  });
});
