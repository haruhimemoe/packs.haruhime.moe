/**
 * @file tests/unit/constants/seo.test.ts
 * @desc SEO_SITE matches the real preview image (1200×630 PNG) and names haruhime.moe as the
 *       organization and parent; every guide, doc and legal description fits a search result
 *       (160 characters) whole, and the home title fits under 60 with the host.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 4, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { DESCRIPTION_MAX, HARUHIME_ORG, pageTitle } from "@haruhimemoe/next-kit/seo";
import { describe, expect, it } from "vitest";
import { CONTENT } from "@/constants/content";
import { SEO_SITE } from "@/constants/seo";

describe("SEO_SITE", () => {
  it("lists the preview image at its real size", () => {
    const png = readFileSync(path.join(process.cwd(), "src/app/opengraph-image.png"));
    const [image] = SEO_SITE.ogImages;
    expect(image).toMatchObject({ url: "/opengraph-image.png", type: "image/png" });
    expect(png.readUInt32BE(16)).toBe(image?.width);
    expect(png.readUInt32BE(20)).toBe(image?.height);
  });

  it("belongs to haruhime.moe", () => {
    expect(SEO_SITE.organization).toBe(HARUHIME_ORG);
    expect(SEO_SITE.parent).toEqual({ name: "haruhime.moe", url: "https://www.haruhime.moe" });
  });

  it("has a home title under 60 characters with the host", () => {
    expect(pageTitle(SEO_SITE, SEO_SITE.title).length).toBeLessThan(60);
    expect(SEO_SITE.description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
  });

  it.each(CONTENT.sections.flatMap((s) => CONTENT.entries[s].map((e) => [e.slug, e] as const)))(
    "%s has a description that fits whole",
    (_slug, { description }) => {
      expect(description.length).toBeLessThanOrEqual(DESCRIPTION_MAX);
    },
  );
});
