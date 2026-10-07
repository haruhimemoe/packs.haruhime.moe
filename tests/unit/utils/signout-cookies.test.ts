/**
 * @file tests/unit/utils/signout-cookies.test.ts
 * @desc What sign-out forwards (only the session token cookie) and clears (bare and __Secure-
 *       session cookies and the marker, on the shared domain only under it).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { clearingCookies, cookieDomainFor, sessionCookieHeader } from "@/utils/signout-cookies";

describe("sessionCookieHeader", () => {
  it("keeps only the session token cookies", () => {
    expect(
      sessionCookieHeader(
        "a=1; better-auth.session_token=t.s; __Secure-better-auth.session_token=u.v; better-auth.session_data=x",
      ),
    ).toBe("better-auth.session_token=t.s; __Secure-better-auth.session_token=u.v");
  });

  it("is null without one", () => {
    expect(sessionCookieHeader(null)).toBeNull();
    expect(sessionCookieHeader("a=1; haruhime-signed-in=1")).toBeNull();
  });
});

describe("cookieDomainFor", () => {
  it("uses the shared domain only for hosts under it", () => {
    expect(cookieDomainFor("packs.haruhime.moe", ".haruhime.moe")).toBe(".haruhime.moe");
    expect(cookieDomainFor("haruhime.moe", ".haruhime.moe")).toBe(".haruhime.moe");
    expect(cookieDomainFor("localhost", ".haruhime.moe")).toBeNull();
    expect(cookieDomainFor("evilharuhime.moe", ".haruhime.moe")).toBeNull();
  });
});

describe("clearingCookies", () => {
  it("expires every session cookie and the marker, with Secure on __Secure- ones", () => {
    const lines = clearingCookies({ marker: "m", domain: ".haruhime.moe", secure: true });
    expect(lines).toHaveLength(5);
    for (const line of lines) {
      expect(line).toMatch(/=; Path=\/; Max-Age=0; SameSite=Lax; Domain=\.haruhime\.moe; Secure$/);
    }
    const local = clearingCookies({ marker: "m", domain: null, secure: false });
    expect(local.find((line) => line.startsWith("m="))).toBe("m=; Path=/; Max-Age=0; SameSite=Lax");
    expect(local.find((line) => line.startsWith("__Secure-"))).toMatch(/; Secure$/);
  });
});
