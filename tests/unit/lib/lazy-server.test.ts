/**
 * @file tests/unit/lib/lazy-server.test.ts
 * @desc With no server env at all (a preview deploy before the owner adds variables), importing
 *       the db and auth modules must not throw; only using them does.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVER_ENV_KEYS } from "@/env";

describe("server modules without env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("import cleanly and fail only when used", async () => {
    for (const key of [...SERVER_ENV_KEYS, "SKIP_ENV_VALIDATION"]) vi.stubEnv(key, "");
    vi.resetModules();
    const db = await import("@/lib/db");
    const auth = await import("@/lib/auth");
    expect(() => auth.getAuth()).toThrow(/Missing or invalid environment variables/);
    expect(() => db.getDb()).toThrow(/Missing or invalid environment variables/);
  });
});
