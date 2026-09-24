/**
 * @file tests/unit/lib/api.test.ts
 * @desc Route-handler errors ({ error: { code, message } }) and body parsing: JSON only, size cap,
 *       invalid JSON, first schema message; the osu! routes' ?ids= list; the same-origin guard on
 *       bodyless cookie mutations.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MAX_SLOTS } from "@/constants/pack";
import {
  ERROR_CODES,
  errorCodeFor,
  jsonError,
  MAX_BODY_BYTES,
  parseBeatmapIds,
  parseJsonBody,
  refuseCrossSite,
} from "@/lib/api";
import { apiErrorSchema } from "@/schemas/api";

const schema = z.object({ name: z.string().min(1, "Name the pack."), n: z.number().default(1) });

const post = (body: string, contentType = "application/json") =>
  new Request("http://localhost/api/x", {
    method: "POST",
    headers: { "content-type": contentType },
    body,
  });

const errorOf = async (result: Awaited<ReturnType<typeof parseJsonBody>>) => {
  if (result.ok) throw new Error("expected a failure");
  return { status: result.response.status, body: await result.response.json() };
};

describe("jsonError", () => {
  it("answers { error: { code, message } } with the status", async () => {
    const response = jsonError(404, "Pack not found.");
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: "not_found", message: "Pack not found." },
    });
  });

  it("takes an explicit code", async () => {
    const response = jsonError(401, "That API key isn't valid.", "invalid_api_key");
    expect(await response.json()).toEqual({
      error: { code: "invalid_api_key", message: "That API key isn't valid." },
    });
  });

  it("always matches the shared error schema", async () => {
    for (const status of Object.keys(ERROR_CODES).map(Number)) {
      expect(apiErrorSchema.safeParse(await jsonError(status, "x").json()).success).toBe(true);
    }
  });
});

describe("errorCodeFor", () => {
  it.each([
    [400, "bad_request"],
    [401, "unauthorized"],
    [404, "not_found"],
    [409, "conflict"],
    [413, "too_large"],
    [415, "unsupported_media_type"],
    [429, "rate_limited"],
    [502, "upstream_error"],
  ])("maps %i to %s", (status, code) => {
    expect(errorCodeFor(status)).toBe(code);
  });

  it("falls back by class for statuses without their own code", () => {
    expect(errorCodeFor(418)).toBe("bad_request");
    expect(errorCodeFor(503)).toBe("internal_error");
  });
});

describe("parseJsonBody", () => {
  it("parses valid JSON with the schema's defaults", async () => {
    expect(await parseJsonBody(post('{"name":"F"}'), schema)).toEqual({
      ok: true,
      data: { name: "F", n: 1 },
    });
  });

  it("accepts a charset on the content type", async () => {
    const result = await parseJsonBody(
      post('{"name":"F"}', "application/json; charset=utf-8"),
      schema,
    );
    expect(result.ok).toBe(true);
  });

  it("refuses anything that isn't JSON with 415", async () => {
    expect(await errorOf(await parseJsonBody(post("name=F", "text/plain"), schema))).toEqual({
      status: 415,
      body: { error: { code: "unsupported_media_type", message: "Send the request as JSON." } },
    });
  });

  it("refuses a body over the cap with 413", async () => {
    const big = JSON.stringify({ name: "x".repeat(MAX_BODY_BYTES) });
    expect((await errorOf(await parseJsonBody(post(big), schema))).status).toBe(413);
  });

  it("refuses a declared oversized body with 413 before reading it", async () => {
    const request = new Request("http://localhost/api/x", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": String(MAX_BODY_BYTES + 1) },
      body: '{"name":"F"}',
    });
    expect((await errorOf(await parseJsonBody(request, schema))).status).toBe(413);
  });

  it("refuses broken JSON with 400", async () => {
    expect(await errorOf(await parseJsonBody(post("{"), schema))).toEqual({
      status: 400,
      body: { error: { code: "bad_request", message: "That request wasn't valid JSON." } },
    });
  });

  it("reports the first schema problem with 400", async () => {
    expect(await errorOf(await parseJsonBody(post('{"name":""}'), schema))).toEqual({
      status: 400,
      body: { error: { code: "bad_request", message: "Name the pack." } },
    });
  });

  it("says what was too large when the route names it", async () => {
    const big = JSON.stringify({ name: "x".repeat(MAX_BODY_BYTES) });
    expect(
      await errorOf(
        await parseJsonBody(post(big), schema, { tooLarge: "That magnet link is too long." }),
      ),
    ).toEqual({
      status: 413,
      body: { error: { code: "too_large", message: "That magnet link is too long." } },
    });
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
