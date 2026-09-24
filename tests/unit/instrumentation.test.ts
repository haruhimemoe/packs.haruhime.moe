/**
 * @file tests/unit/instrumentation.test.ts
 * @desc Server start refuses SKIP_ENV_VALIDATION on a production server that would use a
 *       placeholder secret; builds, dev, Vercel Preview and a fully configured production server
 *       start fine.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { EnvError } from "@/env";
import { register } from "@/instrumentation";
import { TEST_SERVER_ENV } from "../helpers/server-env";

const start = (env: Record<string, string | undefined>) => {
  for (const key of ["NEXT_PHASE", "VERCEL_ENV", ...Object.keys(TEST_SERVER_ENV)]) {
    vi.stubEnv(key, undefined);
  }
  vi.stubEnv("NEXT_RUNTIME", "nodejs");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return register();
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("register (server start)", () => {
  it("throws on a production server with SKIP_ENV_VALIDATION and placeholder secrets", async () => {
    await expect(start({ NODE_ENV: "production", SKIP_ENV_VALIDATION: "true" })).rejects.toThrow(
      EnvError,
    );
  });

  it("starts during next build, in development, and with every real secret", async () => {
    await expect(
      start({
        NODE_ENV: "production",
        SKIP_ENV_VALIDATION: "true",
        NEXT_PHASE: "phase-production-build",
      }),
    ).resolves.toBeUndefined();
    await expect(
      start({ NODE_ENV: "development", SKIP_ENV_VALIDATION: "true" }),
    ).resolves.toBeUndefined();
    await expect(
      start({
        ...TEST_SERVER_ENV,
        MONGODB_URI: "mongodb://db.example:27017",
        NODE_ENV: "production",
        SKIP_ENV_VALIDATION: "true",
      }),
    ).resolves.toBeUndefined();
  });

  it("starts a Vercel Preview deployment without auth config", async () => {
    await expect(
      start({ NODE_ENV: "production", SKIP_ENV_VALIDATION: "true", VERCEL_ENV: "preview" }),
    ).resolves.toBeUndefined();
  });

  it("throws on a Vercel production deployment with placeholder secrets", async () => {
    await expect(
      start({ NODE_ENV: "production", SKIP_ENV_VALIDATION: "true", VERCEL_ENV: "production" }),
    ).rejects.toThrow(EnvError);
  });

  it("does nothing in the edge runtime", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    vi.stubEnv("NEXT_RUNTIME", "edge");
    await expect(register()).resolves.toBeUndefined();
  });
});
