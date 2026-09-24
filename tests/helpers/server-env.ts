/**
 * @file tests/helpers/server-env.ts
 * @desc Fake server env for tests: a complete, valid set of variables (no real secrets) and a
 *       helper that stubs them into process.env.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { vi } from "vitest";

export const TEST_SERVER_ENV = {
  MONGODB_URI: "mongodb://127.0.0.1:27017",
  BETTER_AUTH_SECRET: "t8Vq2Lm5Xr9Kc1Wz4Hn7Pb3Jd6Fs0Gy2Qe5R",
  BETTER_AUTH_URL: "http://localhost:3000",
  OSU_CLIENT_ID: "1",
  OSU_CLIENT_SECRET: "test-osu-client-secret",
} as const;

/**
 * @function stubServerEnv
 * @param overrides {Partial<Record<keyof typeof TEST_SERVER_ENV, string>>} values to change
 * @returns {void} stubs every server variable into process.env (undo with vi.unstubAllEnvs)
 */
export const stubServerEnv = (
  overrides: Partial<Record<keyof typeof TEST_SERVER_ENV, string>> = {},
): void => {
  for (const [key, value] of Object.entries({ ...TEST_SERVER_ENV, ...overrides })) {
    vi.stubEnv(key, value);
  }
};
