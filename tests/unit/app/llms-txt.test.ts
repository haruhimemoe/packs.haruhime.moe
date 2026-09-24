/**
 * @file tests/unit/app/llms-txt.test.ts
 * @desc GET /llms.txt: static, plain text, the builder's output.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { dynamic, GET } from "@/app/llms.txt/route";
import { buildLlmsTxt } from "@/utils/llms-txt";

describe("GET /llms.txt", () => {
  it("is built once at build time", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves the llms.txt body as UTF-8 plain text", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/plain; charset=utf-8");
    expect(await response.text()).toBe(buildLlmsTxt());
  });
});
