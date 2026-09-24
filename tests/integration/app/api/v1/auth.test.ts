/**
 * @file tests/integration/app/api/v1/auth.test.ts
 * @desc /api/v1 key auth and rate limits, through GET /api/v1/me: valid, missing, wrong, revoked
 *       and replaced keys; the per-account and failed-attempt limits and their headers (failed
 *       attempts counted per IPv4 address or IPv6 /64).
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/v1/me/route";
import { RATE_LIMITS } from "@/constants/api";
import { apiMeResponseSchema } from "@/schemas/api";
import { createApiKey, revokeApiKey } from "@/services/api-keys";
import { bearer, createTestApiKey, freezeTime, seedRateLimit } from "../../../../helpers/api-key";
import { createTestUser } from "../../../../helpers/auth";
import { setupTestDb } from "../../../../helpers/db";
import { apiRequest, noContext } from "../../../../helpers/requests";

setupTestDb();
beforeEach(() => freezeTime());
afterEach(() => vi.useRealTimers());

const me = (headers: Record<string, string> = {}) =>
  GET(apiRequest("/api/v1/me", { headers }), noContext);

describe("API key auth", () => {
  it("answers the key's owner, with rate-limit headers and no caching", async () => {
    const user = await createTestUser({ username: "player1" });
    const key = await createTestApiKey(user.id);
    const response = await me(bearer(key));
    expect(response.status).toBe(200);
    expect(apiMeResponseSchema.parse(await response.json())).toEqual({
      user: { id: user.id, osuId: user.osuId, username: "player1" },
    });
    expect(response.headers.get("RateLimit-Limit")).toBe("60");
    expect(response.headers.get("RateLimit-Remaining")).toBe("59");
    expect(response.headers.get("RateLimit-Reset")).toBe("50");
    expect(response.headers.get("Retry-After")).toBeNull();
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("accepts the scheme in any case and ignores surrounding spaces", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    expect((await me({ authorization: `bearer   ${key}  ` })).status).toBe(200);
  });

  it("asks for a key when there is none, counting the failure", async () => {
    const response = await me();
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
    expect(response.headers.get("RateLimit-Limit")).toBe("20");
    expect(response.headers.get("RateLimit-Remaining")).toBe("19");
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it.each([
    ["an unknown key", `hpk_${"A".repeat(43)}`],
    ["a pack key", "pk1.AQRFR0MgAQABAg"],
    ["a cut-off key", "hpk_abc"],
  ])("refuses %s as invalid_api_key", async (_name, token) => {
    const response = await me(bearer(token));
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: "invalid_api_key" } });
    expect(response.headers.get("WWW-Authenticate")).toBe("Bearer");
  });

  it("refuses a replaced key and a revoked key at once", async () => {
    const user = await createTestUser();
    const old = await createTestApiKey(user.id);
    const { key: current } = await createApiKey(user.id);
    expect((await me(bearer(old))).status).toBe(401);
    expect((await me(bearer(current))).status).toBe(200);
    await revokeApiKey(user.id);
    expect((await me(bearer(current))).status).toBe(401);
  });

  it("never reports admin rights, even for an admin", async () => {
    vi.stubEnv("ADMIN_OSU_IDS", "12231334");
    const admin = await createTestUser({ osuId: 12231334 });
    const key = await createTestApiKey(admin.id);
    const body = (await (await me(bearer(key))).json()) as Record<string, Record<string, unknown>>;
    expect(Object.keys(body.user ?? {}).sort()).toEqual(["id", "osuId", "username"]);
  });
});

describe("per-account limit", () => {
  it("allows the 60th request in a minute", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.api, user.id, 59);
    const response = await me(bearer(key));
    expect(response.status).toBe(200);
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");
  });

  it("answers 429 with Retry-After after 60 requests", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.api, user.id, 60);
    const response = await me(bearer(key));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { code: "rate_limited", message: "Too many requests. Try again in 50 seconds." },
    });
    expect(response.headers.get("Retry-After")).toBe("50");
    expect(response.headers.get("RateLimit-Remaining")).toBe("0");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("counts per account, so a regenerated key doesn't start over", async () => {
    const user = await createTestUser();
    await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.api, user.id, 60);
    const { key: fresh } = await createApiKey(user.id);
    expect((await me(bearer(fresh))).status).toBe(429);
  });

  it("starts over in the next minute", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    await seedRateLimit(RATE_LIMITS.api, user.id, 60);
    vi.setSystemTime(new Date("2026-09-22T12:01:00.000Z"));
    const response = await me(bearer(key));
    expect(response.status).toBe(200);
    expect(response.headers.get("RateLimit-Remaining")).toBe("59");
  });
});

describe("failed-attempt limit", () => {
  const BAD = `hpk_${"B".repeat(43)}`;

  it("answers 429 to an IP with 20 failures this minute", async () => {
    await seedRateLimit(RATE_LIMITS.authFail, "203.0.113.9", 20);
    const response = await me(bearer(BAD, { "x-real-ip": "203.0.113.9" }));
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("50");
    expect(response.headers.get("RateLimit-Limit")).toBe("20");
  });

  it("reads the first x-forwarded-for entry when x-real-ip is missing", async () => {
    await seedRateLimit(RATE_LIMITS.authFail, "203.0.113.9", 20);
    const response = await me(bearer(BAD, { "x-forwarded-for": "203.0.113.9, 10.0.0.1" }));
    expect(response.status).toBe(429);
  });

  it("counts every IPv6 address in one /64 as one caller", async () => {
    await seedRateLimit(RATE_LIMITS.authFail, "2001:db8:1:2::/64", 20);
    expect((await me(bearer(BAD, { "x-real-ip": "2001:db8:1:2::abcd" }))).status).toBe(429);
    expect((await me(bearer(BAD, { "x-real-ip": "2001:db8:1:3::abcd" }))).status).toBe(401);
  });

  it("keeps other IPs at 401", async () => {
    await seedRateLimit(RATE_LIMITS.authFail, "203.0.113.9", 20);
    expect((await me(bearer(BAD, { "x-real-ip": "198.51.100.7" }))).status).toBe(401);
  });

  it("still lets a valid key through from that IP", async () => {
    await seedRateLimit(RATE_LIMITS.authFail, "203.0.113.9", 20);
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    expect((await me(bearer(key, { "x-real-ip": "203.0.113.9" }))).status).toBe(200);
  });
});
