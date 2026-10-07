/**
 * @file tests/unit/schemas/account-export.test.ts
 * @desc The export schema is an allow-list: fields it doesn't name (tokens, email) are dropped,
 *       so a secret added to a stored record upstream never reaches the downloaded file.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Oct 6, 2026
 */

import { describe, expect, it } from "vitest";
import { accountExportSchema } from "@/schemas/account-export";

const AT = "2026-09-22T00:00:00.000Z";

const valid = {
  exportedAt: AT,
  user: {
    id: "66f0a0a0a0a0a0a0a0a0a0a0",
    osuId: 2,
    username: "peppy",
    avatarUrl: null,
    country: "AU",
    createdAt: AT,
  },
  packs: [],
  apiKey: null,
};

describe("accountExportSchema", () => {
  it("accepts a well-formed export", () => {
    expect(accountExportSchema.parse(valid)).toEqual(valid);
  });

  it("drops fields it doesn't name", () => {
    const parsed = accountExportSchema.parse({
      ...valid,
      user: { ...valid.user, email: "2@osu.local", emailVerified: false },
      sessions: [{ token: "session-secret" }],
      accessToken: "osu-secret",
    });
    const text = JSON.stringify(parsed);
    for (const secret of ["2@osu.local", "session-secret", "osu-secret", "emailVerified"]) {
      expect(text).not.toContain(secret);
    }
  });

  it("rejects a user without an osu! id", () => {
    const { osuId: _, ...user } = valid.user;
    expect(accountExportSchema.safeParse({ ...valid, user }).success).toBe(false);
  });

  it("accepts key info and never a hash", () => {
    const apiKey = {
      prefix: "hpk_AbCdEfGh",
      createdAt: "2026-09-22T12:00:00.000Z",
      lastUsedAt: null,
      scopes: ["*"],
    };
    const parsed = accountExportSchema.parse({ ...valid, apiKey: { ...apiKey, hash: "abc123" } });
    expect(parsed.apiKey).toEqual(apiKey);
  });
});
