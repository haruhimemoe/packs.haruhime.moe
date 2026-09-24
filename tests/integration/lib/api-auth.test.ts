/**
 * @file tests/integration/lib/api-auth.test.ts
 * @desc withApiKey when something throws: a failing key lookup or a failing handler answers a
 *       JSON 500 that still carries RateLimit headers and Cache-Control: no-store. withPublicApi
 *       (no key): a failing handler answers a JSON 500, and only a success keeps the
 *       Cache-Control its handler set.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RATE_LIMITS } from "@/constants/api";
import { jsonError } from "@/lib/api";
import { SERVER_ERROR, withApiKey, withPublicApi } from "@/lib/api-auth";
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

describe("withPublicApi", () => {
  const call = (handler: () => Promise<Response>) =>
    withPublicApi(RATE_LIMITS.mapUsage, handler)(apiRequest("/api/v1/beatmaps/usage"), noContext);

  it("answers a JSON 500, not cached, when the handler throws", async () => {
    const response = await call(async () => {
      throw new Error("database down");
    });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: "internal_error", message: SERVER_ERROR },
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("keeps a success's own Cache-Control and marks every other answer no-store", async () => {
    const cached = await call(async () =>
      Response.json({}, { headers: { "Cache-Control": "public, s-maxage=60" } }),
    );
    expect(cached.headers.get("Cache-Control")).toBe("public, s-maxage=60");
    expect((await call(async () => Response.json({}))).headers.get("Cache-Control")).toBe(
      "no-store",
    );
    const error = jsonError(400, "Bad.");
    error.headers.set("Cache-Control", "public, s-maxage=60");
    expect((await call(async () => error)).headers.get("Cache-Control")).toBe("no-store");
  });
});
