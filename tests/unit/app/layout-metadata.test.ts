/**
 * @file tests/unit/app/layout-metadata.test.ts
 * @desc Root metadata leaves og:title/description to each page (Next fills them from the page's
 *       title and description only when the root doesn't set them).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("next/font/google", () => ({ Nunito: () => ({ variable: "font-nunito" }) }));

const { metadata } = await import("@/app/layout");

describe("root metadata", () => {
  it("sets site-wide Open Graph fields but not the title or description", () => {
    expect(metadata.openGraph).toMatchObject({
      type: "website",
      siteName: "packs",
      locale: "en_US",
    });
    expect(metadata.openGraph).not.toHaveProperty("title");
    expect(metadata.openGraph).not.toHaveProperty("description");
  });
});
