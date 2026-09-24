/**
 * @file tests/integration/app/api/osu-beatmaps.test.ts
 * @desc GET /api/osu/beatmaps: id validation, CDN caching, 502 when osu! fails, our User-Agent on
 *       every osu! request, and the shared osu! budget (in-memory Mongo): ids the budget refuses,
 *       whose rows fail the schema, or that meet a failing budget counter come back unchecked,
 *       and such an answer isn't cached; the per-IP request limit (429 with Retry-After); and the
 *       per-IP share of osu! calls, spent across this route and star ratings.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/osu/beatmaps/route";
import { GET as getStarRatings } from "@/app/api/osu/star-ratings/route";
import { RATE_LIMITS } from "@/constants/api";
import { MAX_SLOTS } from "@/constants/pack";
import { SERVER_USER_AGENT } from "@/constants/site";
import { OSU_API_BUDGET, RATE_LIMITS_COLLECTION } from "@/constants/star-ratings";
import { getDb } from "@/lib/db";
import { osuBudgetWindow } from "@/lib/osu/attributes";
import { rateLimitId, windowFor } from "@/lib/rate-limit";
import fixture from "../../../fixtures/osu/beatmaps.json";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();

let calls = 0;
let agents: (string | null)[] = [];

const server = setupServer(
  http.post("https://osu.ppy.sh/oauth/token", ({ request }) => {
    agents.push(request.headers.get("user-agent"));
    return HttpResponse.json({ token_type: "Bearer", expires_in: 86400, access_token: "t" });
  }),
  http.get("https://osu.ppy.sh/api/v2/beatmaps", ({ request }) => {
    calls++;
    agents.push(request.headers.get("user-agent"));
    return HttpResponse.json(fixture);
  }),
);

/** The fixture's row for 75, as difficulty `id` of set `id + 1000`. */
const row = (id: number) => ({ ...fixture.beatmaps[0], id, beatmapset_id: id + 1000 });
/** Answers every asked id with a good row. */
const everyAskedId = http.get("https://osu.ppy.sh/api/v2/beatmaps", ({ request }) => {
  calls++;
  const ids = new URL(request.url).searchParams.getAll("ids[]").map(Number);
  return HttpResponse.json({ beatmaps: ids.map(row) });
});
const setCounter = (count: unknown) => {
  const { id, expiresAt } = osuBudgetWindow(Date.now());
  return getDb()
    .collection<{ _id: string; count: unknown; expiresAt: Date }>(RATE_LIMITS_COLLECTION)
    .insertOne({ _id: id, count, expiresAt });
};
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  vi.useRealTimers();
});
afterAll(() => server.close());
beforeEach(() => {
  calls = 0;
  agents = [];
  // Only Date is faked: the budget window must not roll over mid-test.
  vi.useFakeTimers({ toFake: ["Date"], now: Date.parse("2026-09-22T12:00:10.000Z") });
});

const call = (query: string) => GET(new Request(`http://localhost:3000/api/osu/beatmaps${query}`));

describe("GET /api/osu/beatmaps", () => {
  it("returns metadata with a CDN cache header", async () => {
    const response = await call("?ids=75");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("s-maxage=86400");
    const { beatmaps, unchecked } = (await response.json()) as {
      beatmaps: { beatmapId: number }[];
      unchecked: number[];
    };
    expect(beatmaps.map((b) => b.beatmapId)).toEqual([75]);
    expect(unchecked).toEqual([]);
  });

  it("sends our User-Agent on every osu! request", async () => {
    await call("?ids=75");
    expect(agents.length).toBeGreaterThan(0);
    expect(agents).toEqual(agents.map(() => SERVER_USER_AGENT));
  });

  it.each([
    "",
    "?ids=",
    "?ids=abc",
    "?ids=0",
    "?ids=1.5",
    `?ids=${Array.from({ length: MAX_SLOTS + 1 }, (_, i) => i + 1).join(",")}`,
  ])("rejects %j with 400", async (query) => {
    expect((await call(query)).status).toBe(400);
  });

  it("answers 502 when osu! fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(
      http.get("https://osu.ppy.sh/api/v2/beatmaps", () => new HttpResponse(null, { status: 503 })),
    );
    const response = await call("?ids=75");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: { code: "upstream_error", message: "osu! didn't answer. Try again later." },
    });
  });

  it("counts each osu! call against the shared budget", async () => {
    await call("?ids=75");
    const counter = await getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: osuBudgetWindow(Date.now()).id });
    expect(counter?.count).toBe(1);
  });

  it("sends nothing to osu! and caches nothing when the budget is spent", async () => {
    await setCounter(OSU_API_BUDGET.limit);
    const response = await call("?ids=75");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ beatmaps: [], unchecked: [75] });
    expect(calls).toBe(0);
  });

  it("keeps the first batch and leaves the refused second batch unchecked", async () => {
    server.use(everyAskedId);
    await setCounter(OSU_API_BUDGET.limit - 1);
    const ids = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1);
    const response = await call(`?ids=${ids.join(",")}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      beatmaps: { beatmapId: number }[];
      unchecked: number[];
    };
    expect(body.beatmaps.map((b) => b.beatmapId)).toEqual(ids.slice(0, 50));
    expect(body.unchecked).toEqual(ids.slice(50));
    expect(calls).toBe(1);
  });

  it("leaves a row that fails the schema unchecked and keeps the good ones", async () => {
    server.use(
      http.get("https://osu.ppy.sh/api/v2/beatmaps", () =>
        HttpResponse.json({ beatmaps: [row(75), { ...row(76), mode: "not-a-ruleset" }] }),
      ),
    );
    const response = await call("?ids=75,76");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const body = (await response.json()) as {
      beatmaps: { beatmapId: number }[];
      unchecked: number[];
    };
    expect(body.beatmaps.map((b) => b.beatmapId)).toEqual([75]);
    expect(body.unchecked).toEqual([76]);
  });

  it("leaves every id unchecked, without calling osu!, when the budget counter fails", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    server.use(everyAskedId);
    // $inc on a string throws: the counter can't be written, as with MongoDB unreachable.
    await setCounter("broken");
    const ids = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1);
    const response = await call(`?ids=${ids.join(",")}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ beatmaps: [], unchecked: ids });
    expect(calls).toBe(0);
    expect(logged).toHaveBeenCalledTimes(1);
  });
});

describe("GET /api/osu/beatmaps per-IP limit", () => {
  const rule = RATE_LIMITS.osuBeatmaps;
  const from = (ip: string) =>
    GET(
      new Request("http://localhost:3000/api/osu/beatmaps?ids=75", {
        headers: { "x-real-ip": ip },
      }),
    );

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
    expect(calls).toBe(0);
    expect((await from("203.0.113.10")).status).toBe(200);
    const counted = await getDb()
      .collection<{ _id: string; count: number }>(RATE_LIMITS_COLLECTION)
      .findOne({ _id: rateLimitId(rule, "203.0.113.10", Date.now()) });
    expect(counted?.count).toBe(1);
  });
});

describe("GET /api/osu/beatmaps per-IP share of osu! calls", () => {
  it("leaves every id unchecked, without calling osu!, after 20 star-rating calls from that IP", async () => {
    let starCalls = 0;
    server.use(
      everyAskedId,
      http.post("https://osu.ppy.sh/api/v2/beatmaps/:id/attributes", () => {
        starCalls++;
        return HttpResponse.json({ attributes: { star_rating: 5 } });
      }),
    );
    const headers = { "x-real-ip": "203.0.113.9" };
    const q = Array.from({ length: 20 }, (_, i) => `${i + 1}:HD`).join(",");
    await getStarRatings(
      new Request(`http://localhost:3000/api/osu/star-ratings?q=${q}`, { headers }),
    );
    expect(starCalls).toBe(20);
    const response = await GET(
      new Request("http://localhost:3000/api/osu/beatmaps?ids=75,76", { headers }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ beatmaps: [], unchecked: [75, 76] });
    expect(calls).toBe(0);
    const other = await GET(
      new Request("http://localhost:3000/api/osu/beatmaps?ids=75", {
        headers: { "x-real-ip": "198.51.100.7" },
      }),
    );
    expect(((await other.json()) as { unchecked: number[] }).unchecked).toEqual([]);
    expect(calls).toBe(1);
  });
});
