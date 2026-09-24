/**
 * @file tests/unit/env.test.ts
 * @desc Server env parsing: valid input, missing/invalid names (never values), blanks, and the CI
 *       SKIP_ENV_VALIDATION escape hatch, which a production server refuses when it would fall
 *       back to a placeholder secret (a production build still may). On Vercel, only VERCEL_ENV
 *       production counts as production, so Preview deployments without auth config start. The
 *       optional CRON_SECRET is read on its own: when set it must be too long to guess, and a bad
 *       value only breaks the cron route, never the rest of the server env.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import {
  assertNoPlaceholderSecrets,
  EnvError,
  getCronSecret,
  isEnvValidationSkipped,
  parseDatabaseEnv,
  parseServerEnv,
  SERVER_ENV_KEYS,
} from "@/env";
import { TEST_SERVER_ENV } from "../helpers/server-env";

const errorFrom = (source: Record<string, string | undefined>): Error => {
  try {
    parseServerEnv(source);
  } catch (error) {
    return error as Error;
  }
  throw new Error("expected parseServerEnv to throw");
};

describe("parseServerEnv", () => {
  it("returns exactly the server variables", () => {
    expect(parseServerEnv({ ...TEST_SERVER_ENV, UNRELATED: "x" })).toEqual(TEST_SERVER_ENV);
  });

  it("names every missing variable, in schema order", () => {
    const error = errorFrom({});
    expect(error).toBeInstanceOf(EnvError);
    expect(error.message).toBe(
      `Missing or invalid environment variables: ${SERVER_ENV_KEYS.filter((key) => key !== "ADMIN_OSU_IDS").join(", ")}. See .env.example.`,
    );
  });

  it("never puts a value in the error message", () => {
    const secret = "short-secret-value";
    const error = errorFrom({ ...TEST_SERVER_ENV, BETTER_AUTH_SECRET: secret });
    expect(error.message).toContain("BETTER_AUTH_SECRET");
    expect(error.message).not.toContain(secret);
  });

  it("treats blank values as missing", () => {
    expect(errorFrom({ ...TEST_SERVER_ENV, OSU_CLIENT_SECRET: "   " }).message).toContain(
      "OSU_CLIENT_SECRET",
    );
  });

  it("rejects a non-numeric osu! client id", () => {
    expect(errorFrom({ ...TEST_SERVER_ENV, OSU_CLIENT_ID: "abc" }).message).toContain(
      "OSU_CLIENT_ID",
    );
  });

  it("rejects a URI that isn't MongoDB", () => {
    expect(errorFrom({ ...TEST_SERVER_ENV, MONGODB_URI: "postgres://x" }).message).toContain(
      "MONGODB_URI",
    );
  });

  it("fills placeholders under SKIP_ENV_VALIDATION but keeps real values", () => {
    const env = parseServerEnv({ SKIP_ENV_VALIDATION: "true", OSU_CLIENT_ID: "42" });
    expect(env.OSU_CLIENT_ID).toBe("42");
    expect(env.BETTER_AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.MONGODB_URI).toMatch(/^mongodb:\/\//);
    expect(env.BETTER_AUTH_URL).toBe("http://localhost:3000");
  });
});

describe("ADMIN_OSU_IDS", () => {
  it("is optional", () => {
    expect(parseServerEnv({ ...TEST_SERVER_ENV }).ADMIN_OSU_IDS).toBeUndefined();
    expect(
      parseServerEnv({ ...TEST_SERVER_ENV, ADMIN_OSU_IDS: "  " }).ADMIN_OSU_IDS,
    ).toBeUndefined();
  });

  it("accepts ids separated by commas and spaces", () => {
    expect(parseServerEnv({ ...TEST_SERVER_ENV, ADMIN_OSU_IDS: "12231334, 2" }).ADMIN_OSU_IDS).toBe(
      "12231334, 2",
    );
  });

  it.each(["abc", "1,,2", "1;2", "12231334,"])("rejects %j without printing it", (value) => {
    const error = errorFrom({ ...TEST_SERVER_ENV, ADMIN_OSU_IDS: value });
    expect(error.message).toContain("ADMIN_OSU_IDS");
    expect(error.message).not.toContain(value);
  });
});

describe("CRON_SECRET", () => {
  it("isn't part of the server env, so only the cron route reads it", () => {
    expect(SERVER_ENV_KEYS).not.toContain("CRON_SECRET");
    const secret = "a-cron-secret-of-32-characters!!";
    expect(parseServerEnv({ ...TEST_SERVER_ENV, CRON_SECRET: secret })).toEqual(TEST_SERVER_ENV);
  });

  it("can't break sign-in and the rest of the site when it's too short", () => {
    expect(parseServerEnv({ ...TEST_SERVER_ENV, CRON_SECRET: "short-secret" })).toEqual(
      TEST_SERVER_ENV,
    );
  });
});

describe("getCronSecret", () => {
  it("reads CRON_SECRET on every call, trimmed, undefined when unset", () => {
    try {
      vi.stubEnv("CRON_SECRET", "");
      expect(getCronSecret()).toBeUndefined();
      vi.stubEnv("CRON_SECRET", "  a-cron-secret-of-32-characters!!  ");
      expect(getCronSecret()).toBe("a-cron-secret-of-32-characters!!");
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("throws, naming it but not printing it, when it's too short", () => {
    vi.stubEnv("CRON_SECRET", "short-secret");
    try {
      expect(() => getCronSecret()).toThrow(
        new EnvError("Missing or invalid environment variables: CRON_SECRET. See .env.example."),
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

describe("isEnvValidationSkipped", () => {
  it("is true only for SKIP_ENV_VALIDATION=true", () => {
    vi.stubEnv("SKIP_ENV_VALIDATION", "true");
    expect(isEnvValidationSkipped()).toBe(true);
    vi.stubEnv("SKIP_ENV_VALIDATION", "1");
    expect(isEnvValidationSkipped()).toBe(false);
    vi.unstubAllEnvs();
  });
});

describe("parseDatabaseEnv", () => {
  it("needs only MONGODB_URI, so builds without auth config can still read public packs", () => {
    expect(parseDatabaseEnv({ MONGODB_URI: " mongodb://db.example:27017 " })).toEqual({
      MONGODB_URI: "mongodb://db.example:27017",
    });
  });

  it("names MONGODB_URI when it's missing or wrong, never printing it", () => {
    for (const value of [undefined, "  ", "postgres://secret@x"]) {
      let error: unknown;
      try {
        parseDatabaseEnv({ ...TEST_SERVER_ENV, MONGODB_URI: value });
      } catch (caught) {
        error = caught;
      }
      expect(error).toBeInstanceOf(EnvError);
      expect((error as Error).message).toBe(
        "Missing or invalid environment variables: MONGODB_URI. See .env.example.",
      );
    }
  });

  it("falls back to the placeholder under SKIP_ENV_VALIDATION", () => {
    expect(parseDatabaseEnv({ SKIP_ENV_VALIDATION: "true" }).MONGODB_URI).toMatch(/^mongodb:\/\//);
  });
});

describe("SKIP_ENV_VALIDATION in production", () => {
  const SKIP_IN_PROD = { SKIP_ENV_VALIDATION: "true", NODE_ENV: "production" };
  const SECRETS = ["BETTER_AUTH_SECRET", "OSU_CLIENT_SECRET", "MONGODB_URI"] as const;

  it("throws at runtime, naming every secret that would be a placeholder", () => {
    for (const parse of [parseServerEnv, assertNoPlaceholderSecrets]) {
      expect(() => parse(SKIP_IN_PROD)).toThrow(EnvError);
      expect(() => parse(SKIP_IN_PROD)).toThrow(
        "SKIP_ENV_VALIDATION is set on a production server, so BETTER_AUTH_SECRET, OSU_CLIENT_SECRET, MONGODB_URI would fall back to public placeholders. Set the real values and unset SKIP_ENV_VALIDATION.",
      );
    }
  });

  it.each(SECRETS)("throws when only %s is missing", (key) => {
    const source = { ...TEST_SERVER_ENV, ...SKIP_IN_PROD, [key]: undefined };
    expect(() => parseServerEnv(source)).toThrow(key);
  });

  it("throws for the database URI on its own too", () => {
    expect(() => parseDatabaseEnv(SKIP_IN_PROD)).toThrow("MONGODB_URI");
    expect(parseDatabaseEnv({ ...SKIP_IN_PROD, MONGODB_URI: "mongodb://db:27017" })).toEqual({
      MONGODB_URI: "mongodb://db:27017",
    });
  });

  it("throws when a secret is set to the placeholder itself", () => {
    const placeholder = parseServerEnv({ SKIP_ENV_VALIDATION: "true" }).BETTER_AUTH_SECRET;
    const source = { ...TEST_SERVER_ENV, ...SKIP_IN_PROD, BETTER_AUTH_SECRET: placeholder };
    expect(() => parseServerEnv(source)).toThrow("BETTER_AUTH_SECRET");
  });

  it("allows it with every real secret set", () => {
    // TEST_SERVER_ENV's MONGODB_URI happens to equal the placeholder, so use another one.
    const real = { ...TEST_SERVER_ENV, MONGODB_URI: "mongodb://db.example:27017" };
    expect(parseServerEnv({ ...real, ...SKIP_IN_PROD })).toEqual(real);
  });

  it("allows it during next build (NEXT_PHASE=phase-production-build) and outside production", () => {
    expect(() =>
      parseServerEnv({ ...SKIP_IN_PROD, NEXT_PHASE: "phase-production-build" }),
    ).not.toThrow();
    expect(() =>
      parseDatabaseEnv({ ...SKIP_IN_PROD, NEXT_PHASE: "phase-production-build" }),
    ).not.toThrow();
    expect(() => parseServerEnv({ SKIP_ENV_VALIDATION: "true", NODE_ENV: "test" })).not.toThrow();
  });
});

describe("SKIP_ENV_VALIDATION on Vercel (VERCEL_ENV set)", () => {
  const SKIP_IN_PROD = { SKIP_ENV_VALIDATION: "true", NODE_ENV: "production" };

  it.each(["preview", "development"])(
    "allows placeholders on a VERCEL_ENV=%s deployment, though NODE_ENV is production",
    (vercelEnv) => {
      const source = { ...SKIP_IN_PROD, VERCEL_ENV: vercelEnv };
      expect(() => assertNoPlaceholderSecrets(source)).not.toThrow();
      expect(() => parseServerEnv(source)).not.toThrow();
      expect(() => parseDatabaseEnv(source)).not.toThrow();
    },
  );

  it("throws on VERCEL_ENV=production, naming every placeholder secret", () => {
    const source = { ...SKIP_IN_PROD, VERCEL_ENV: "production" };
    expect(() => assertNoPlaceholderSecrets(source)).toThrow(
      "BETTER_AUTH_SECRET, OSU_CLIENT_SECRET, MONGODB_URI",
    );
    expect(() => parseServerEnv(source)).toThrow(EnvError);
    expect(() => parseDatabaseEnv(source)).toThrow("MONGODB_URI");
  });

  it("goes by VERCEL_ENV, not NODE_ENV, whenever VERCEL_ENV is set", () => {
    expect(() =>
      assertNoPlaceholderSecrets({
        SKIP_ENV_VALIDATION: "true",
        NODE_ENV: "development",
        VERCEL_ENV: "production",
      }),
    ).toThrow(EnvError);
  });

  it("still allows a production build on VERCEL_ENV=production", () => {
    expect(() =>
      assertNoPlaceholderSecrets({
        ...SKIP_IN_PROD,
        VERCEL_ENV: "production",
        NEXT_PHASE: "phase-production-build",
      }),
    ).not.toThrow();
  });

  it("keeps the NODE_ENV rule when VERCEL_ENV is unset or blank", () => {
    expect(() => assertNoPlaceholderSecrets(SKIP_IN_PROD)).toThrow(EnvError);
    expect(() => assertNoPlaceholderSecrets({ ...SKIP_IN_PROD, VERCEL_ENV: "" })).toThrow(EnvError);
  });
});
