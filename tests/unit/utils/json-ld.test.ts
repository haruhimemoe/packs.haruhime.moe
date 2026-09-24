/**
 * @file tests/unit/utils/json-ld.test.ts
 * @desc JSON-LD serialization can't close the script tag it sits in.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { jsonLdString } from "@/utils/json-ld";

describe("jsonLdString", () => {
  it("escapes < so text can't end the script element", () => {
    const text = jsonLdString({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(JSON.parse(text)).toMatchObject({ name: "</script><script>alert(1)</script>" });
  });

  it("adds the schema.org context", () => {
    expect(JSON.parse(jsonLdString({ "@type": "Thing" }))).toEqual({
      "@context": "https://schema.org",
      "@type": "Thing",
    });
  });
});
