/**
 * @file tests/unit/app/openapi-route.test.ts
 * @desc /api/v1/openapi.json is static JSON of buildOpenApiDocument().
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { dynamic, GET } from "@/app/api/v1/openapi.json/route";
import { buildOpenApiDocument } from "@/lib/openapi";

describe("/api/v1/openapi.json", () => {
  it("is static", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves the document as JSON", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual(buildOpenApiDocument());
  });
});
