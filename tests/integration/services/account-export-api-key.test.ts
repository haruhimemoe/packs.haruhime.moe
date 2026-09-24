/**
 * @file tests/integration/services/account-export-api-key.test.ts
 * @desc "Download my data" includes the API key's prefix and dates, never the key or its hash.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { hashApiKey } from "@/lib/api-key";
import { exportAccountData } from "@/services/account-export";
import { createApiKey } from "@/services/api-keys";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";

setupTestDb();

describe("exportAccountData: apiKey", () => {
  it("is null without a key", async () => {
    const user = await createTestUser();
    expect((await exportAccountData(user.id)).apiKey).toBeNull();
  });

  it("has the prefix and dates, never the key or its hash", async () => {
    const user = await createTestUser();
    const { key, apiKey } = await createApiKey(user.id);
    const data = await exportAccountData(user.id);
    expect(data.apiKey).toEqual(apiKey);
    const text = JSON.stringify(data);
    expect(text).not.toContain(key);
    expect(text).not.toContain(hashApiKey(key));
  });

  it("never includes another user's key", async () => {
    const mine = await createTestUser();
    const theirs = await createTestUser();
    const { apiKey } = await createApiKey(theirs.id);
    const data = await exportAccountData(mine.id);
    expect(data.apiKey).toBeNull();
    expect(JSON.stringify(data)).not.toContain(apiKey.prefix);
  });
});
