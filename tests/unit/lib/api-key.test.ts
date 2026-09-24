/**
 * @file tests/unit/lib/api-key.test.ts
 * @desc API key format, hashing, display prefix, and Authorization header parsing.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { API_KEY_DISPLAY_LENGTH, API_KEY_PREFIX } from "@/constants/api";
import {
  apiKeyPrefix,
  bearerToken,
  generateApiKey,
  hashApiKey,
  isApiKeyFormat,
} from "@/lib/api-key";

const headers = (authorization?: string) =>
  new Headers(authorization === undefined ? {} : { authorization });

describe("generateApiKey", () => {
  it("is hpk_ plus 32 random bytes in base64url", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^hpk_[A-Za-z0-9_-]{43}$/);
    expect(key.startsWith(API_KEY_PREFIX)).toBe(true);
    expect(isApiKeyFormat(key)).toBe(true);
  });

  it("never repeats", () => {
    const keys = new Set(Array.from({ length: 200 }, generateApiKey));
    expect(keys.size).toBe(200);
  });
});

describe("hashApiKey", () => {
  it("is SHA-256 hex", () => {
    expect(hashApiKey("hpk_test")).toBe(
      "98104252b18a60d97de9105ed1d51cfe544d634edea9d4e0f3b9985c71e6d370",
    );
  });

  it("differs for different keys", () => {
    expect(hashApiKey(generateApiKey())).not.toBe(hashApiKey(generateApiKey()));
  });
});

describe("apiKeyPrefix", () => {
  it("keeps the first 12 characters", () => {
    const key = `hpk_${"AbCdEfGh".repeat(5)}xyz`;
    expect(apiKeyPrefix(key)).toBe("hpk_AbCdEfGh");
    expect(apiKeyPrefix(key)).toHaveLength(API_KEY_DISPLAY_LENGTH);
  });
});

describe("isApiKeyFormat", () => {
  it.each([
    ["", false],
    ["hpk_", false],
    [`hpk_${"A".repeat(42)}`, false],
    [`hpk_${"A".repeat(44)}`, false],
    [`hpk_${"A".repeat(42)}=`, false],
    [`HPK_${"A".repeat(43)}`, false],
    ["pk1.AQRFR0MgAQABAg", false],
    [`hpk_${"A".repeat(43)}`, true],
    [`hpk_${"-_".repeat(21)}a`, true],
  ])("%j is %s", (value, expected) => {
    expect(isApiKeyFormat(value)).toBe(expected);
  });
});

describe("bearerToken", () => {
  const KEY = `hpk_${"A".repeat(43)}`;

  it("reads a Bearer token", () => {
    expect(bearerToken(headers(`Bearer ${KEY}`))).toBe(KEY);
  });

  it("accepts the scheme in any case and ignores extra spaces", () => {
    expect(bearerToken(headers(`bearer   ${KEY}  `))).toBe(KEY);
    expect(bearerToken(headers(`BEARER\t${KEY}`))).toBe(KEY);
  });

  it.each([undefined, "", "Bearer", "Bearer ", `Basic ${KEY}`, `Bearer ${KEY} extra`, KEY])(
    "is null for %j",
    (value) => {
      expect(bearerToken(headers(value))).toBeNull();
    },
  );

  it("returns a wrong-looking token as-is so the caller can count the failure", () => {
    expect(bearerToken(headers("Bearer pk1.AQRFR0MgAQABAg"))).toBe("pk1.AQRFR0MgAQABAg");
  });
});
