/**
 * @file tests/unit/constants/legal.test.ts
 * @desc Legal doc registry + slug guard (unknown slugs must never reach the MDX loader).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { isLegalSlug, LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { formatIsoDate } from "@/utils/date";

describe("LEGAL_DOCS", () => {
  it("has an entry with a title and a valid lastUpdated date for every slug", () => {
    for (const slug of LEGAL_SLUGS) {
      expect(LEGAL_DOCS[slug].title.length).toBeGreaterThan(0);
      expect(() => formatIsoDate(LEGAL_DOCS[slug].lastUpdated)).not.toThrow();
    }
  });

  it("titles the rights page for the laws it covers", () => {
    expect(LEGAL_DOCS["your-privacy-rights"].title).toBe("GDPR & CCPA");
  });
});

describe("isLegalSlug", () => {
  it.each(LEGAL_SLUGS)("accepts %s", (slug) => {
    expect(isLegalSlug(slug)).toBe(true);
  });

  it.each(["", "Terms", "terms/", "../terms", "__proto__", "constructor", "toString"])(
    "rejects %j",
    (value) => {
      expect(isLegalSlug(value)).toBe(false);
    },
  );
});
