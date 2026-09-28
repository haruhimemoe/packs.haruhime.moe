/**
 * @file tests/integration/app/api/auth-sign-in-limit.test.ts
 * @desc POST /api/auth/sign-in/*: each IP may start RATE_LIMITS.signIn sign-ins a minute, counted
 *       in rate_limits across instances (audit: better-auth's limiter was per instance); past it a
 *       no-store 429, other IPs and other auth paths unaffected.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/[...all]/route";
import { RATE_LIMITS } from "@/constants/api";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();

const signIn = (ip: string, path = "/api/auth/sign-in/oauth2") =>
  POST(
    new Request(`http://localhost:3000${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-real-ip": ip },
      body: JSON.stringify({ providerId: "osu", callbackURL: "/me" }),
    }),
  );

describe("POST /api/auth/sign-in/*", () => {
  it("refuses an IP past its sign-ins this minute, and only that IP", async () => {
    for (let i = 0; i < RATE_LIMITS.signIn.limit; i++) {
      expect((await signIn("203.0.113.9")).status).not.toBe(429);
    }
    const refused = await signIn("203.0.113.9");
    expect(refused.status).toBe(429);
    expect(refused.headers.get("cache-control")).toBe("no-store");
    expect((await signIn("198.51.100.7")).status).not.toBe(429);
  });

  it("doesn't count other auth paths", async () => {
    for (let i = 0; i <= RATE_LIMITS.signIn.limit; i++) {
      expect((await signIn("203.0.113.9", "/api/auth/sign-out")).status).not.toBe(429);
    }
  });
});
