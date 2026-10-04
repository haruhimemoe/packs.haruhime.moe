/**
 * @file tests/unit/app/llms-full-txt.test.ts
 * @desc GET /llms-full.txt: static Markdown with every guide and doc under its own title and
 *       source URL, each title once, and no MDX left in it.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 4, 2026
 */

import { describe, expect, it } from "vitest";
import { dynamic, GET } from "@/app/llms-full.txt/route";
import { CONTENT } from "@/constants/content";

describe("GET /llms-full.txt", () => {
  it("is built once at build time", () => {
    expect(dynamic).toBe("force-static");
  });

  it("serves Markdown with every doc, guide and legal page, each title once", async () => {
    const response = await GET();
    expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
    const text = await response.text();
    for (const section of ["docs", "guides", "legal"] as const) {
      for (const { slug, title } of CONTENT.entries[section]) {
        expect(text).toContain(
          `# ${title}\n\nSource: https://packs.haruhime.moe/${section}/${slug}\n`,
        );
        expect(text.split(`\n# ${title}\n`)).toHaveLength(2);
      }
    }
    expect(text).not.toMatch(/^(import|export) /m);
  });
});
