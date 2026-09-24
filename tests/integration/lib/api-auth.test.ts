/**
 * @file tests/integration/lib/api-auth.test.ts
 * @desc withApiKey when something throws: a failing key lookup or a failing handler answers a
 *       JSON 500 that still carries RateLimit headers and Cache-Control: no-store.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SERVER_ERROR, withApiKey } from "@/lib/api-auth";
import { authenticateApiKey } from "@/services/api-keys";
import { bearer, createTestApiKey, freezeTime } from "../../helpers/api-key";
import { createTestUser } from "../../helpers/auth";
import { setupTestDb } from "../../helpers/db";
import { apiRequest, noContext } from "../../helpers/requests";

vi.mock("@/services/api-keys", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/api-keys")>();
  return { ...actual, authenticateApiKey: vi.fn(actual.authenticateApiKey) };
});

setupTestDb();
beforeEach(() => {
  freezeTime();
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

const expectServerError = async (response: Response, remaining: string) => {
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: { code: "internal_error", message: SERVER_ERROR },
  });
  expect(response.headers.get("RateLimit-Limit")).toBe("60");
  expect(response.headers.get("RateLimit-Remaining")).toBe(remaining);
  expect(response.headers.get("RateLimit-Reset")).toBe("50");
  expect(response.headers.get("Cache-Control")).toBe("no-store");
};

describe("withApiKey errors", () => {
  it("answers a JSON 500 when the handler throws", async () => {
    const user = await createTestUser();
    const key = await createTestApiKey(user.id);
    const handler = withApiKey(async () => {
      throw new Error("corrupt pack");
    });
    await expectServerError(
      await handler(apiRequest("/api/v1/me", { headers: bearer(key) }), noContext),
      "59",
    );
  });

  it("answers a JSON 500 when the key lookup throws", async () => {
    vi.mocked(authenticateApiKey).mockRejectedValueOnce(new Error("database down"));
    const handler = withApiKey(async () => Response.json({}));
    await expectServerError(
      await handler(
        apiRequest("/api/v1/me", { headers: bearer(`hpk_${"A".repeat(43)}`) }),
        noContext,
      ),
      "60",
    );
  });
});
