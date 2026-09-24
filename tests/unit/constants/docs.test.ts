/**
 * @file tests/unit/constants/docs.test.ts
 * @desc Docs registry: every slug has an MDX file, title, and description; lookalikes rejected.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DOC_DOCS, DOC_SLUGS, isDocSlug } from "@/constants/docs";

describe("docs registry", () => {
  it.each(DOC_SLUGS)("%s has an MDX file, a title, and a description", (slug) => {
    expect(existsSync(path.join(process.cwd(), "content", "docs", `${slug}.mdx`))).toBe(true);
    expect(DOC_DOCS[slug].title.length).toBeGreaterThan(0);
    expect(DOC_DOCS[slug].description.length).toBeGreaterThan(0);
  });

  it.each(["", "API", "__proto__", "../legal/terms"])("rejects %j", (value) => {
    expect(isDocSlug(value)).toBe(false);
  });
});
