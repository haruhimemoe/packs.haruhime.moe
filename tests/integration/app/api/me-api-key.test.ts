/**
 * @file tests/integration/app/api/me-api-key.test.ts
 * @desc /api/me/api-key (session auth): read, create, regenerate, revoke, and the
 *       10-per-hour create limit.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "@/app/api/me/api-key/route";
import { hashApiKey } from "@/lib/api-key";
import { apiKeyCreatedSchema } from "@/schemas/api";
import { authenticateApiKey } from "@/services/api-keys";
import { freezeTime } from "../../../helpers/api-key";
import { createTestUser } from "../../../helpers/auth";
import { setupTestDb } from "../../../helpers/db";
import { apiRequest } from "../../../helpers/requests";

setupTestDb();
afterEach(() => vi.useRealTimers());

const PATH = "/api/me/api-key";
const read = (cookie?: string) => GET(apiRequest(PATH, { cookie }));
const create = (cookie?: string) => POST(apiRequest(PATH, { method: "POST", cookie }));
const revoke = (cookie?: string) => DELETE(apiRequest(PATH, { method: "DELETE", cookie }));

describe("/api/me/api-key", () => {
  it("asks signed-out callers to sign in", async () => {
    for (const response of [await read(), await create(), await revoke()]) {
      expect(response.status).toBe(401);
      expect(await response.json()).toMatchObject({ error: { code: "unauthorized" } });
    }
  });

  it("creates a key, shows it once, then only its prefix and dates", async () => {
    freezeTime();
    const user = await createTestUser();
    const empty = await read(user.cookie);
    expect(await empty.json()).toEqual({ apiKey: null });
    expect(empty.headers.get("Cache-Control")).toBe("no-store");

    const created = await create(user.cookie);
    expect(created.status).toBe(201);
    expect(created.headers.get("Cache-Control")).toBe("no-store");
    expect(created.headers.get("RateLimit-Limit")).toBe("10");
    expect(created.headers.get("RateLimit-Remaining")).toBe("9");
    const body = apiKeyCreatedSchema.parse(await created.json());
    expect(body.apiKey).toEqual({
      prefix: body.key.slice(0, 12),
      createdAt: "2026-09-22T12:00:10.000Z",
      lastUsedAt: null,
    });

    const text = await (await read(user.cookie)).text();
    expect(JSON.parse(text)).toEqual({ apiKey: body.apiKey });
    expect(text).not.toContain(body.key);
    expect(text).not.toContain(hashApiKey(body.key));
  });

  it("regenerates: the old key stops working at once", async () => {
    const user = await createTestUser();
    const first = apiKeyCreatedSchema.parse(await (await create(user.cookie)).json());
    const second = apiKeyCreatedSchema.parse(await (await create(user.cookie)).json());
    expect(await authenticateApiKey(first.key)).toBeNull();
    expect(await authenticateApiKey(second.key)).toMatchObject({ id: user.id });
  });

  it("revokes, then says there is nothing to revoke", async () => {
    const user = await createTestUser();
    const { key } = apiKeyCreatedSchema.parse(await (await create(user.cookie)).json());
    expect((await revoke(user.cookie)).status).toBe(204);
    expect(await authenticateApiKey(key)).toBeNull();
    const again = await revoke(user.cookie);
    expect(again.status).toBe(404);
    expect(await again.json()).toEqual({
      error: { code: "not_found", message: "You don't have an API key." },
    });
  });

  it("allows 10 creates an hour, then answers 429 and keeps the last key", async () => {
    freezeTime();
    const user = await createTestUser();
    let last = "";
    for (let i = 0; i < 10; i++) {
      const response = await create(user.cookie);
      expect(response.status).toBe(201);
      last = apiKeyCreatedSchema.parse(await response.json()).key;
    }
    const refused = await create(user.cookie);
    expect(refused.status).toBe(429);
    expect(refused.headers.get("Retry-After")).toBe("3590");
    expect(await refused.json()).toMatchObject({ error: { code: "rate_limited" } });
    expect(await authenticateApiKey(last)).toMatchObject({ id: user.id });
  });

  it("never touches another user's key", async () => {
    const one = await createTestUser();
    const two = await createTestUser();
    const { key } = apiKeyCreatedSchema.parse(await (await create(one.cookie)).json());
    await create(two.cookie);
    await revoke(two.cookie);
    expect(await authenticateApiKey(key)).toMatchObject({ id: one.id });
  });

  it("refuses a create or revoke from another origin or a cross-site request, key untouched", async () => {
    const user = await createTestUser();
    const { key } = apiKeyCreatedSchema.parse(await (await create(user.cookie)).json());
    const foreign: Record<string, string>[] = [
      { origin: "https://pools.haruhime.moe" },
      { "sec-fetch-site": "cross-site" },
    ];
    for (const headers of foreign) {
      for (const method of ["POST", "DELETE"]) {
        const handler = method === "POST" ? POST : DELETE;
        const response = await handler(apiRequest(PATH, { method, cookie: user.cookie, headers }));
        expect(response.status).toBe(403);
      }
    }
    expect(await authenticateApiKey(key)).toMatchObject({ id: user.id });
  });

  it("creates a key for a same-origin request", async () => {
    const user = await createTestUser();
    const response = await POST(
      apiRequest(PATH, {
        method: "POST",
        cookie: user.cookie,
        headers: { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
      }),
    );
    expect(response.status).toBe(201);
  });
});
