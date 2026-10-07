/**
 * @file tests/integration/app/api/internal-account.test.ts
 * @desc /api/internal/account/[op]: the hub's account fan-out. 503 while ACCOUNT_FANOUT_SECRET is
 *       unset, 401 without it, 404 for an unknown op, export with the user's API key info,
 *       delete removing the key (and answering 204 again on a repeat).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Oct 6, 2026
 * @modified Tue Oct 6, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/internal/account/[op]/route";
import { apiKeys } from "@/lib/api-keys";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";

setupTestDb();
afterEach(() => vi.unstubAllEnvs());

const SECRET = "s".repeat(40);

const call = (op: string, userId: string, secret: string | null = SECRET) =>
  POST(
    new Request(`http://localhost/api/internal/account/${op}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body: JSON.stringify({ userId }),
    }),
    { params: Promise.resolve({ op }) },
  );

describe("/api/internal/account/[op]", () => {
  it("refuses every call while the secret is unset", async () => {
    vi.stubEnv("ACCOUNT_FANOUT_SECRET", "");
    const response = await call("export", "a".repeat(24));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  });

  it("needs the bearer secret and a known op", async () => {
    vi.stubEnv("ACCOUNT_FANOUT_SECRET", SECRET);
    expect((await call("export", "a".repeat(24), null)).status).toBe(401);
    expect((await call("export", "a".repeat(24), "x".repeat(40))).status).toBe(401);
    expect((await call("purge", "a".repeat(24))).status).toBe(404);
  });

  it("exports the user's data and deletes it", async () => {
    vi.stubEnv("ACCOUNT_FANOUT_SECRET", SECRET);
    const user = await createTestUser();
    await apiKeys.issue(user.id);
    const exported = await call("export", user.id);
    expect(exported.status).toBe(200);
    expect(await exported.json()).toMatchObject({ apiKey: { scopes: ["*"] } });

    expect((await call("delete", user.id)).status).toBe(204);
    expect(await apiKeys.info(user.id)).toBeNull();
    expect((await call("delete", user.id)).status).toBe(204);
  });
});
