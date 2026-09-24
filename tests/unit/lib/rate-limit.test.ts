/**
 * @file tests/unit/lib/rate-limit.test.ts
 * @desc Rate-limit window math, headers, the 429 body, and fail-open when counting breaks.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  connectedDb: vi.fn(async () => {
    throw new Error("server selection timed out");
  }),
}));

const { RATE_LIMITS } = await import("@/constants/api");
const { hitRateLimit, rateLimitHeaders, rateLimitId, retryText, tooManyRequests, windowFor } =
  await import("@/lib/rate-limit");

const AT = (iso: string) => new Date(iso).getTime();

describe("windowFor", () => {
  it("snaps to the start of the minute", () => {
    const w = windowFor(RATE_LIMITS.api, AT("2026-09-22T12:00:10.250Z"));
    expect(new Date(w.start).toISOString()).toBe("2026-09-22T12:00:00.000Z");
    expect(new Date(w.end).toISOString()).toBe("2026-09-22T12:01:00.000Z");
    expect(w.resetSeconds).toBe(50);
  });

  it("gives a full window at its first millisecond and 1 s at its last", () => {
    expect(windowFor(RATE_LIMITS.api, AT("2026-09-22T12:00:00.000Z")).resetSeconds).toBe(60);
    expect(windowFor(RATE_LIMITS.api, AT("2026-09-22T12:00:59.999Z")).resetSeconds).toBe(1);
  });

  it("puts :59.999 and :00.000 in different windows", () => {
    expect(rateLimitId(RATE_LIMITS.api, "u", AT("2026-09-22T12:00:59.999Z"))).not.toBe(
      rateLimitId(RATE_LIMITS.api, "u", AT("2026-09-22T12:01:00.000Z")),
    );
  });

  it("keeps a counter one minute past its window", () => {
    const w = windowFor(RATE_LIMITS.api, AT("2026-09-22T12:00:10.000Z"));
    expect(w.expiresAt.toISOString()).toBe("2026-09-22T12:02:00.000Z");
  });

  it("uses hour windows for key creation", () => {
    const w = windowFor(RATE_LIMITS.keyCreate, AT("2026-09-22T12:30:00.000Z"));
    expect(new Date(w.start).toISOString()).toBe("2026-09-22T12:00:00.000Z");
    expect(w.resetSeconds).toBe(1800);
  });
});

describe("rateLimitId", () => {
  it("is scope:subject:windowStartSeconds", () => {
    expect(rateLimitId(RATE_LIMITS.authFail, "203.0.113.9", AT("2026-09-22T12:00:10.000Z"))).toBe(
      `auth-fail:203.0.113.9:${AT("2026-09-22T12:00:00.000Z") / 1000}`,
    );
  });
});

describe("rateLimitHeaders", () => {
  it("sends limit, remaining and reset", () => {
    expect(rateLimitHeaders({ allowed: true, limit: 60, remaining: 12, resetSeconds: 30 })).toEqual(
      { "RateLimit-Limit": "60", "RateLimit-Remaining": "12", "RateLimit-Reset": "30" },
    );
  });

  it("adds Retry-After when refused", () => {
    expect(
      rateLimitHeaders({ allowed: false, limit: 60, remaining: 0, resetSeconds: 30 }),
    ).toMatchObject({ "Retry-After": "30" });
  });
});

describe("retryText", () => {
  it.each([
    [1, "1 second"],
    [45, "45 seconds"],
    [60, "1 minute"],
    [61, "2 minutes"],
    [1800, "30 minutes"],
  ])("%i is %j", (seconds, text) => {
    expect(retryText(seconds)).toBe(text);
  });
});

describe("tooManyRequests", () => {
  it("answers 429 rate_limited with every header", async () => {
    const response = tooManyRequests({ allowed: false, limit: 10, remaining: 0, resetSeconds: 42 });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: { code: "rate_limited", message: "Too many requests. Try again in 42 seconds." },
    });
    expect(response.headers.get("Retry-After")).toBe("42");
    expect(response.headers.get("RateLimit-Limit")).toBe("10");
  });
});

describe("hitRateLimit when the database is down", () => {
  it("allows the request and logs the failure", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const result = await hitRateLimit(RATE_LIMITS.api, "u1", new Date("2026-09-22T12:00:10.000Z"));
    expect(result).toEqual({ allowed: true, limit: 60, remaining: 60, resetSeconds: 50 });
    expect(error).toHaveBeenCalledWith("rate limit: couldn't count api", expect.any(Error));
    error.mockRestore();
  });
});
