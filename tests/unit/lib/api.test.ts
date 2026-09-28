/**
 * @file tests/unit/lib/api.test.ts
 * @desc Route-handler errors ({ error: { code, message } }) and body parsing: JSON only, size cap,
 *       invalid JSON, first schema message; the osu! routes' ?ids= list; the same-origin guard on
 *       bodyless cookie mutations.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import type { parseJsonBody } from "@haruhimemoe/next-kit/server";
import { MAX_SLOTS } from "@haruhimemoe/pool";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PACK_TOO_LARGE, parseBeatmapIds, parsePackBody, refuseCrossSite } from "@/lib/api";
import { apiErrorSchema } from "@/schemas/api";

const _schema = z.object({ name: z.string().min(1, "Name the pack."), n: z.number().default(1) });

const _post = (body: string, contentType = "application/json") =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

const _errorOf = async (result: Awaited<ReturnType<typeof parseJsonBody>>) => {
  if (result.ok) throw new Error("expected a failure");
  return { status: result.response.status, body: await result.response.json() };
};

describe("parsePackBody", () => {
  it("keeps the pack's own wording for a body over the size cap", async () => {
    const request = new Request("http://localhost:3000/api/packs", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "20000" },
      body: "{}",
    });
    const result = await parsePackBody(request, z.object({}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(413);
      expect(apiErrorSchema.parse(await result.response.json()).error.message).toBe(PACK_TOO_LARGE);
    }
  });
});

describe("parseBeatmapIds", () => {
  it("keeps the ids in the order sent", () => {
    expect(parseBeatmapIds("3,1,2")).toEqual([3, 1, 2]);
  });

  it("accepts a full pool", () => {
    const ids = Array.from({ length: MAX_SLOTS }, (_, i) => i + 1);
    expect(parseBeatmapIds(ids.join(","))).toEqual(ids);
  });

  it.each([
    null,
    "",
    "abc",
    "0",
    "1.5",
    "-3",
    "2147483648",
    Array.from({ length: MAX_SLOTS + 1 }, (_, i) => i + 1).join(","),
  ])("rejects %j", (raw) => {
    expect(parseBeatmapIds(raw)).toBeNull();
  });

  it("rejects an overlong ids list before splitting it", () => {
    const split = vi.spyOn(String.prototype, "split");
    const result = parseBeatmapIds("1,".repeat(MAX_SLOTS * 11));
    const splits = split.mock.calls.length;
    split.mockRestore();
    expect(result).toBeNull();
    expect(splits).toBe(0);
  });
});

describe("refuseCrossSite", () => {
  const post = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/me/api-key", { method: "POST", headers });

  it.each([
    ["no Origin or Sec-Fetch-Site (curl, older browsers)", {}],
    ["the request's own origin", { origin: "http://localhost:3000" }],
    ["the site's origin", { origin: "https://packs.haruhime.moe" }],
    [
      "Sec-Fetch-Site same-origin",
      { origin: "http://localhost:3000", "sec-fetch-site": "same-origin" },
    ],
    ["Sec-Fetch-Site none (typed by the user)", { "sec-fetch-site": "none" }],
  ])("lets through %s", (_, headers) => {
    expect(refuseCrossSite(post(headers))).toBeNull();
  });

  it.each([
    ["a sibling subdomain's Origin", { origin: "https://pools.haruhime.moe" }],
    ["another site's Origin", { origin: "https://evil.example" }],
    ["Origin null (sandboxed frame)", { origin: "null" }],
    ["the same host over another scheme", { origin: "https://localhost:3000" }],
    ["Sec-Fetch-Site cross-site", { "sec-fetch-site": "cross-site" }],
    ["Sec-Fetch-Site same-site", { "sec-fetch-site": "same-site" }],
  ])("refuses %s with 403", async (_, headers) => {
    const response = refuseCrossSite(post(headers));
    expect(response?.status).toBe(403);
    expect(await response?.json()).toMatchObject({ error: { code: "forbidden" } });
  });
});
