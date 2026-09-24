/**
 * @file tests/unit/utils/llms-txt-api.test.ts
 * @desc llms.txt carries an API section (each doc's Markdown copy and the OpenAPI document)
 *       before Legal.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { OPENAPI_PATH } from "@/constants/api";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { SITE } from "@/constants/site";
import { buildLlmsTxt, llmsSections } from "@/utils/llms-txt";

describe("llms.txt API section", () => {
  it("lists every doc's Markdown copy and the OpenAPI document", () => {
    const api = llmsSections().find((section) => section.heading === "API");
    expect(api?.links.map((link) => link.url)).toEqual([
      ...DOC_SLUGS.map((slug) => `${SITE.url}/docs/${slug}.md`),
      `${SITE.url}${OPENAPI_PATH}`,
    ]);
  });

  it("renders before Legal", () => {
    const text = buildLlmsTxt();
    expect(text).toContain(`[${DOC_DOCS.api.title}](${SITE.url}/docs/api.md)`);
    expect(text.indexOf("## API")).toBeGreaterThan(-1);
    expect(text.indexOf("## API")).toBeLessThan(text.indexOf("## Legal"));
  });
});
