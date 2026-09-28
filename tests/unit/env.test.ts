/**
 * @file tests/unit/env.test.ts
 * @desc packs' env wiring over @haruhimemoe/next-kit/env (parsing, placeholders and the production
 *       rule are the package's own tests): the five server variables, ADMIN_OSU_IDS read on every
 *       call, CRON_SECRET and POOLS_SERVICE_TOKEN kept out of the server env, MONGODB_URI read
 *       alone, and the placeholder guard.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { EnvError } from "@haruhimemoe/next-kit/env";
import { stubOsuAppEnv, TEST_OSU_APP_ENV } from "@haruhimemoe/next-kit/testing";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertNoPlaceholderSecrets,
  getAdminOsuIds,
  getCronSecret,
  getDatabaseUri,
  getPoolsServiceToken,
  parseServerEnv,
  SERVER_ENV_KEYS,
} from "@/env";

vi.mock("server-only", () => ({}));

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("parseServerEnv", () => {
  it("returns exactly the five server variables", () => {
    expect(parseServerEnv({ ...TEST_OSU_APP_ENV, ADMIN_OSU_IDS: "2" })).toEqual(TEST_OSU_APP_ENV);
    expect([...SERVER_ENV_KEYS].sort()).toEqual(Object.keys(TEST_OSU_APP_ENV).sort());
  });

  it("names a missing variable without printing values", () => {
    const { OSU_CLIENT_SECRET: _, ...rest } = TEST_OSU_APP_ENV;
    expect(() => parseServerEnv(rest)).toThrow(/OSU_CLIENT_SECRET/);
    expect(() => parseServerEnv(rest)).not.toThrow(new RegExp(TEST_OSU_APP_ENV.BETTER_AUTH_SECRET));
  });

  it("fills placeholders under SKIP_ENV_VALIDATION", () => {
    expect(parseServerEnv({ SKIP_ENV_VALIDATION: "true" }).OSU_CLIENT_ID).toBe("0");
  });
});

describe("assertNoPlaceholderSecrets", () => {
  it("refuses placeholders on a production server with the skip flag", () => {
    const source = { SKIP_ENV_VALIDATION: "true", VERCEL_ENV: "production" };
    expect(() => assertNoPlaceholderSecrets(source)).toThrow(EnvError);
    expect(() => assertNoPlaceholderSecrets({ ...source, VERCEL_ENV: "preview" })).not.toThrow();
  });
});

describe("getDatabaseUri", () => {
  it("reads MONGODB_URI alone, so a build without auth config can read packs", () => {
    vi.stubEnv("MONGODB_URI", "mongodb://db.test:27017");
    expect(getDatabaseUri()).toBe("mongodb://db.test:27017");
  });
});

describe("getAdminOsuIds", () => {
  it("is empty when unset and reads the list on every call", () => {
    stubOsuAppEnv();
    expect(getAdminOsuIds().size).toBe(0);
    vi.stubEnv("ADMIN_OSU_IDS", "12231334, 2 ,3");
    expect([...getAdminOsuIds()]).toEqual([12231334, 2, 3]);
    vi.stubEnv("ADMIN_OSU_IDS", "2");
    expect([...getAdminOsuIds()]).toEqual([2]);
  });

  it("names ADMIN_OSU_IDS when it isn't a list of ids", () => {
    vi.stubEnv("ADMIN_OSU_IDS", "someone");
    expect(() => getAdminOsuIds()).toThrow(/ADMIN_OSU_IDS/);
  });
});

describe.each([
  ["CRON_SECRET", getCronSecret, 16],
  ["POOLS_SERVICE_TOKEN", getPoolsServiceToken, 32],
] as const)("%s", (key, read, minLength) => {
  it("isn't part of the server env, so a bad value can't break sign-in", () => {
    stubOsuAppEnv({ [key]: "short" });
    expect(SERVER_ENV_KEYS).not.toContain(key);
    expect(() => parseServerEnv(process.env)).not.toThrow();
    expect(() => read()).toThrow(new RegExp(key));
  });

  it("is read on every call, trimmed, and undefined when unset", () => {
    expect(read()).toBeUndefined();
    vi.stubEnv(key, ` ${"x".repeat(minLength)}\n`);
    expect(read()).toBe("x".repeat(minLength));
  });
});
