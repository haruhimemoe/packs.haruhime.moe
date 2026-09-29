/**
 * @file tests/unit/app/llms-full-txt.test.ts
 * @desc GET /llms-full.txt: static Markdown with every guide and doc under its own title and
 *       source URL, each title once, and no MDX left in it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Mon Sep 28, 2026
 */

import { describe, expect, it } from "vitest";
import { dynamic, GET } from "@/app/llms-full.txt/route";
import { DOC_DOCS, DOC_SLUGS } from "@/constants/docs";
import { GUIDE_DOCS, GUIDE_SLUGS } from "@/constants/guide";

describe("GET /llms-full.txt", () => {
  it("is built once at build time", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves Markdown with every guide and doc, each title once", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const text = await response.text();
    for (const slug of GUIDE_SLUGS) {
      const { title } = GUIDE_DOCS[slug];
      expect(text).toContain(`# ${title}\n\nSource: https://packs.haruhime.moe/guide/${slug}\n`);
      expect(text.split(`\n# ${title}\n`)).toHaveLength(2);
    }
    for (const slug of DOC_SLUGS) {
      expect(text).toContain(
        `# ${DOC_DOCS[slug].title}\n\nSource: https://packs.haruhime.moe/docs/${slug}\n`,
      );
    }
    expect(text).not.toMatch(/^(import|export) /m);
  });
});
