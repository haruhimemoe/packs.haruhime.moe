/**
 * @file tests/integration/lib/machine-auth.test.ts
 * @desc refuseWithoutPoolsToken: lets the right token through (pasted with spaces or a newline,
 *       or exactly 32 characters, too); 503 not_configured while POOLS_SERVICE_TOKEN is unset or
 *       shorter than 32, naming it in the log but never printing it; 401 for a missing or wrong
 *       token; 429 once one IP has failed 10 times in a minute, while other IPs and the right
 *       token still get through. Every refusal is no-store.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/constants/api";
import { refuseWithoutPoolsToken } from "@/lib/machine-auth";
import { freezeTime } from "../../helpers/api-key";
import { setupTestDb } from "../../helpers/db";
import { apiRequest } from "../../helpers/requests";

setupTestDb();

const TOKEN = "pools-service-token-for-tests-0123456789";

const call = (authorization?: string, ip = "198.51.100.4") =>
  refuseWithoutPoolsToken(
    apiRequest("/api/service/pools/stats", {
      method: "POST",
      headers: { ...(authorization === undefined ? {} : { authorization }), "x-real-ip": ip },
    }),
  );

const codeOf = async (response: Response | null): Promise<string | null> =>
  response ? ((await response.json()) as { error: { code: string } }).error.code : null;

describe("refuseWithoutPoolsToken", () => {
  beforeEach(() => {
    freezeTime();
    vi.stubEnv("POOLS_SERVICE_TOKEN", TOKEN);
  });
  afterEach(() => {
    // Not vi.unstubAllEnvs(): the integration setup stubs the server env (MONGODB_URI) too.
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    vi.useRealTimers();
  });

  it("lets the right token through", async () => {
    expect(await call(`Bearer ${TOKEN}`)).toBeNull();
  });

  it("takes a token pasted with spaces or a trailing newline", async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", `  ${TOKEN}\n`);
    expect(await call(`Bearer ${TOKEN}`)).toBeNull();
  });

  it("takes a token of exactly 32 characters and refuses one of 31 as not set up", async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "a".repeat(32));
    expect(await call(`Bearer ${"a".repeat(32)}`)).toBeNull();
    vi.stubEnv("POOLS_SERVICE_TOKEN", "a".repeat(31));
    const response = await call(`Bearer ${"a".repeat(31)}`);
    expect(response?.status).toBe(503);
    expect(await codeOf(response)).toBe("not_configured");
  });

  it("refuses everything while the token isn't set, whatever is sent", async () => {
    vi.stubEnv("POOLS_SERVICE_TOKEN", "");
    for (const authorization of [undefined, "Bearer ", `Bearer ${TOKEN}`]) {
      const response = await call(authorization);
      expect(response?.status).toBe(503);
      expect(response?.headers.get("cache-control")).toBe("no-store");
      expect(await codeOf(response)).toBe("not_configured");
    }
  });

  it("names a short token in the log but never prints it", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("POOLS_SERVICE_TOKEN", "short-but-secret");
    await call("Bearer short-but-secret");
    const logged = error.mock.calls.flat().map(String).join(" ");
    expect(logged).toContain("POOLS_SERVICE_TOKEN");
    expect(logged).not.toContain("short-but-secret");
    error.mockRestore();
  });

  it.each([
    ["no header", undefined],
    ["a wrong token", "Bearer not-the-pools-token-at-all-000000000"],
    ["the token without Bearer", TOKEN],
    ["a longer token", `Bearer ${TOKEN}x`],
    ["an empty token", "Bearer "],
  ])("answers 401 to %s, never cached", async (_label, authorization) => {
    const response = await call(authorization);
    expect(response?.status).toBe(401);
    expect(response?.headers.get("cache-control")).toBe("no-store");
  });

  it(`answers 429 after ${RATE_LIMITS.serviceAuthFail.limit} failures a minute from one IP`, async () => {
    for (let i = 0; i < RATE_LIMITS.serviceAuthFail.limit; i++) {
      expect((await call("Bearer wrong"))?.status).toBe(401);
    }
    const limited = await call("Bearer wrong");
    expect(limited?.status).toBe(429);
    expect(limited?.headers.get("retry-after")).toMatch(/^\d+$/);
    expect(await codeOf(limited)).toBe("rate_limited");
    // Another IP still gets its own tries, and the right token is never counted or refused.
    expect((await call("Bearer wrong", "198.51.100.5"))?.status).toBe(401);
    expect(await call(`Bearer ${TOKEN}`)).toBeNull();
  });
});
