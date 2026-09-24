/**
 * @file tests/unit/utils/safe-next.test.ts
 * @desc Post-sign-in destinations stay on this site.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_AFTER_SIGN_IN, safeNextPath, signInHref } from "@/utils/safe-next";

describe("safeNextPath", () => {
  it.each(["/new", "/p/abcdefghij/edit", "/me?tab=packs"])("keeps %j", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([
    null,
    undefined,
    "",
    "new",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/ok\\..\\evil",
    "/\n//evil.example",
    `/${"a".repeat(600)}`,
  ])("replaces %j with the default", (raw) => {
    expect(safeNextPath(raw)).toBe(DEFAULT_AFTER_SIGN_IN);
  });
});

describe("signInHref", () => {
  it("encodes the destination", () => {
    expect(signInHref("/p/abc?x=1")).toBe("/signin?next=%2Fp%2Fabc%3Fx%3D1");
  });
});
