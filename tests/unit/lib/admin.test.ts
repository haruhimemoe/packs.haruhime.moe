/**
 * @file tests/unit/lib/admin.test.ts
 * @desc isAdminOsuId: true only for an id ADMIN_OSU_IDS lists, read on every call, so a removed
 *       admin loses access at the next request.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { isAdminOsuId } from "@/lib/admin";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isAdminOsuId", () => {
  it("is false for everyone when ADMIN_OSU_IDS is unset", () => {
    vi.stubEnv("ADMIN_OSU_IDS", "");
    expect(isAdminOsuId(12231334)).toBe(false);
  });

  it("follows the list as it changes", () => {
    vi.stubEnv("ADMIN_OSU_IDS", "12231334, 2");
    expect(isAdminOsuId(12231334)).toBe(true);
    expect(isAdminOsuId(3)).toBe(false);
    vi.stubEnv("ADMIN_OSU_IDS", "2");
    expect(isAdminOsuId(12231334)).toBe(false);
  });
});
