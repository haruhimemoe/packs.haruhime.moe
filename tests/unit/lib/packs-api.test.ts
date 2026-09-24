/**
 * @file tests/unit/lib/packs-api.test.ts
 * @desc Browser client for our packs API: requests, parsed responses, server messages.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createPacksApi, PacksApiError } from "@/lib/packs-api";

const BASE = "http://localhost";
const PACK = { name: "F", slots: [{ mod: "NM" as const, index: 1, beatmapId: 129891 }] };
const SAVED = {
  ...PACK,
  slug: "abcdefghij",
  visibility: "unlisted",
  createdAt: "2026-09-22T23:30:00.000Z",
  updatedAt: "2026-09-22T23:30:00.000Z",
};

const calls: { method: string; path: string; body: unknown }[] = [];
const server = setupServer(
  http.all(`${BASE}/api/*`, async ({ request }) => {
    const url = new URL(request.url);
    const text = await request.text();
    calls.push({
      method: request.method,
      path: url.pathname,
      body: text ? JSON.parse(text) : null,
    });
    if (request.method === "DELETE") return new HttpResponse(null, { status: 204 });
    return HttpResponse.json({ pack: SAVED }, { status: request.method === "POST" ? 201 : 200 });
  }),
);
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();
  calls.length = 0;
});
afterAll(() => server.close());

const api = createPacksApi({ baseUrl: BASE });

describe("createPacksApi", () => {
  it("creates a pack", async () => {
    expect(await api.create(PACK)).toEqual(SAVED);
    expect(calls).toEqual([{ method: "POST", path: "/api/packs", body: PACK }]);
  });

  it("updates, removes, and deletes the account", async () => {
    await api.update("abcdefghij", { ...PACK, visibility: "private" });
    await api.remove("abcdefghij");
    await api.deleteAccount();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual([
      "PUT /api/packs/abcdefghij",
      "DELETE /api/packs/abcdefghij",
      "DELETE /api/me",
    ]);
  });

  it("surfaces the server's message and status", async () => {
    server.use(
      http.post(`${BASE}/api/packs`, () =>
        HttpResponse.json(
          { error: { code: "unauthorized", message: "Sign in with osu! to save packs." } },
          { status: 401 },
        ),
      ),
    );
    await expect(api.create(PACK)).rejects.toMatchObject({
      name: "PacksApiError",
      status: 401,
      message: "Sign in with osu! to save packs.",
    });
  });

  it("falls back to a generic message for a non-JSON error", async () => {
    server.use(http.post(`${BASE}/api/packs`, () => new HttpResponse("oops", { status: 500 })));
    await expect(api.create(PACK)).rejects.toMatchObject({
      status: 500,
      message: "Something went wrong (500). Try again.",
    });
  });

  it("explains a network failure", async () => {
    server.use(http.post(`${BASE}/api/packs`, () => HttpResponse.error()));
    const error = await api.create(PACK).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(PacksApiError);
    expect((error as PacksApiError).status).toBeNull();
  });

  it("hides a pack with PATCH and returns the admin row", async () => {
    const row = {
      slug: "abcdefghij",
      name: "F",
      ownerName: "peppy",
      ownerOsuId: 2,
      visibility: "public",
      slotCount: 1,
      updatedAt: "2026-09-22T23:30:00.000Z",
      hiddenAt: "2026-09-22T23:40:00.000Z",
    };
    server.use(
      http.patch(`${BASE}/api/admin/packs/:slug`, async ({ request }) => {
        calls.push({
          method: "PATCH",
          path: new URL(request.url).pathname,
          body: await request.json(),
        });
        return HttpResponse.json({ pack: row });
      }),
    );
    expect(await api.setHidden("abcdefghij", true)).toEqual(row);
    expect(calls).toEqual([
      { method: "PATCH", path: "/api/admin/packs/abcdefghij", body: { hidden: true } },
    ]);
  });

  it("runs the pack stats job as an admin with POST", async () => {
    server.use(
      http.post(`${BASE}/api/admin/pack-stats`, ({ request }) => {
        calls.push({ method: "POST", path: new URL(request.url).pathname, body: null });
        return HttpResponse.json({ updated: 3, remaining: 12 });
      }),
    );
    expect(await api.fillPackStats()).toEqual({ updated: 3, remaining: 12 });
    expect(calls).toEqual([{ method: "POST", path: "/api/admin/pack-stats", body: null }]);
  });

  it("deletes as an admin with DELETE", async () => {
    await api.adminRemove("abcdefghij");
    expect(calls).toEqual([{ method: "DELETE", path: "/api/admin/packs/abcdefghij", body: null }]);
  });

  it("removes one magnet link as an admin with DELETE", async () => {
    const url = `magnet:?xt=urn:btih:${"a".repeat(40)}&dn=F`;
    server.use(
      http.delete(`${BASE}/api/admin/packs/abcdefghij/exports`, ({ request }) => {
        calls.push({
          method: "DELETE",
          path: `/api/admin/packs/abcdefghij/exports?url=${new URL(request.url).searchParams.get("url")}`,
          body: null,
        });
        return HttpResponse.json({ exports: [] });
      }),
    );
    expect(await api.adminRemoveMagnet("abcdefghij", url)).toEqual([]);
    expect(calls).toEqual([
      { method: "DELETE", path: `/api/admin/packs/abcdefghij/exports?url=${url}`, body: null },
    ]);
  });

  it("adds and removes magnet links", async () => {
    const url = `magnet:?xt=urn:btih:${"a".repeat(40)}&dn=F`;
    const exports = [{ kind: "magnet", url, createdAt: "2026-09-22T23:30:00.000Z" }];
    server.use(
      http.post(`${BASE}/api/packs/abcdefghij/exports`, async ({ request }) => {
        calls.push({
          method: "POST",
          path: "/api/packs/abcdefghij/exports",
          body: await request.json(),
        });
        return HttpResponse.json({ exports });
      }),
      http.delete(`${BASE}/api/packs/abcdefghij/exports`, ({ request }) => {
        calls.push({
          method: "DELETE",
          path: `/api/packs/abcdefghij/exports?url=${new URL(request.url).searchParams.get("url")}`,
          body: null,
        });
        return HttpResponse.json({ exports: [] });
      }),
    );
    expect(await api.addMagnet("abcdefghij", url, "pk1.test")).toEqual(exports);
    expect(await api.removeMagnet("abcdefghij", url)).toEqual([]);
    expect(calls).toEqual([
      {
        method: "POST",
        path: "/api/packs/abcdefghij/exports",
        body: { kind: "magnet", url, packKey: "pk1.test" },
      },
      { method: "DELETE", path: `/api/packs/abcdefghij/exports?url=${url}`, body: null },
    ]);
  });

  it("gets a pack for this viewer, and null when it's not found", async () => {
    server.use(
      http.get(`${BASE}/api/packs/abcdefghij`, () =>
        HttpResponse.json({ pack: SAVED, isOwner: true }),
      ),
      http.get(`${BASE}/api/packs/zzzzzzzzzz`, () =>
        HttpResponse.json(
          { error: { code: "not_found", message: "Pack not found." } },
          { status: 404 },
        ),
      ),
    );
    expect(await api.get("abcdefghij")).toEqual({ pack: SAVED, isOwner: true, isAdmin: false });
    expect(await api.get("zzzzzzzzzz")).toBeNull();
  });

  it("says when the viewer is an admin", async () => {
    server.use(
      http.get(`${BASE}/api/packs/abcdefghij`, () =>
        HttpResponse.json({ pack: SAVED, isOwner: false, isAdmin: true }),
      ),
    );
    expect(await api.get("abcdefghij")).toEqual({ pack: SAVED, isOwner: false, isAdmin: true });
  });

  it("falls back to a generic message for an old-style error body", async () => {
    server.use(
      http.post(
        `${BASE}/api/packs`,
        () => HttpResponse.json({ error: "plain string" }, { status: 500 }), // legacy-shape on purpose
      ),
    );
    await expect(api.create(PACK)).rejects.toMatchObject({
      status: 500,
      message: "Something went wrong (500). Try again.",
    });
  });
});

describe("API key client", () => {
  const CREATED = {
    key: `hpk_${"A".repeat(43)}`,
    apiKey: { prefix: "hpk_AAAAAAAA", createdAt: "2026-09-22T12:00:00.000Z", lastUsedAt: null },
  };

  it("creates a key", async () => {
    server.use(
      http.post(`${BASE}/api/me/api-key`, () => HttpResponse.json(CREATED, { status: 201 })),
    );
    expect(await api.createApiKey()).toEqual(CREATED);
  });

  it("revokes the key", async () => {
    await api.revokeApiKey();
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(["DELETE /api/me/api-key"]);
  });

  it("surfaces the rate-limit message", async () => {
    server.use(
      http.post(`${BASE}/api/me/api-key`, () =>
        HttpResponse.json(
          {
            error: { code: "rate_limited", message: "Too many requests. Try again in 40 minutes." },
          },
          { status: 429 },
        ),
      ),
    );
    await expect(api.createApiKey()).rejects.toMatchObject({
      status: 429,
      message: "Too many requests. Try again in 40 minutes.",
    });
  });
});
