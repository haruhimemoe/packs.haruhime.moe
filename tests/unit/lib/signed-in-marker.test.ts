/**
 * @file tests/unit/lib/signed-in-marker.test.ts
 * @desc The readable "signed in" marker cookie: reading it, clearing it, and its lifetime.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import {
  clearSignedInMarker,
  hasSignedInMarker,
  markerMaxAge,
  SIGNED_IN_COOKIE,
} from "@/lib/signed-in-marker";

describe("signed-in marker", () => {
  it("is named packs-signed-in", () => {
    expect(SIGNED_IN_COOKIE).toBe("packs-signed-in");
  });

  it.each([
    ["packs-signed-in=1", true],
    ["a=b; packs-signed-in=1; c=d", true],
    ["packs-signed-in=0", false],
    ["xpacks-signed-in=1", false],
    ["", false],
  ])("reads %j as %s", (cookie, expected) => {
    expect(hasSignedInMarker(cookie)).toBe(expected);
  });

  it("lives until the session expires, never negative", () => {
    const now = Date.parse("2026-09-22T00:00:00Z");
    expect(markerMaxAge("2026-09-29T00:00:00Z", now)).toBe(7 * 24 * 60 * 60);
    expect(markerMaxAge(new Date(now - 1000), now)).toBe(0);
  });

  it("clears itself by expiring", () => {
    const target = { cookie: "" };
    clearSignedInMarker(target);
    expect(target.cookie).toBe("packs-signed-in=; Path=/; Max-Age=0; SameSite=Lax");
  });
});
