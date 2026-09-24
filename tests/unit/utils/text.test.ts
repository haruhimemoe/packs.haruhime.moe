/**
 * @file tests/unit/utils/text.test.ts
 * @desc Description normalization, excerpts, page meta descriptions, regex escaping.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { escapeRegExp, excerpt, metaDescription, normalizeDescription } from "@/utils/text";

describe("normalizeDescription", () => {
  it("turns CRLF and CR into LF and trims", () => {
    expect(normalizeDescription("  one\r\ntwo\rthree \n")).toBe("one\ntwo\nthree");
  });
});

describe("excerpt", () => {
  it("keeps short text, collapsing whitespace", () => {
    expect(excerpt("  Qualifiers\n\npool  for SPC ", 140)).toBe("Qualifiers pool for SPC");
  });

  it("cuts long text at the limit and adds an ellipsis", () => {
    expect(excerpt("abcdef", 3)).toBe("abc…");
    expect(excerpt("ab cdef", 3)).toBe("ab…");
  });

  it("never splits an emoji or a CJK character", () => {
    expect(excerpt("🌸🌸🌸🌸", 2)).toBe("🌸🌸…");
    expect(excerpt("難しい譜面です", 3)).toBe("難しい…");
  });

  it("returns an empty string for empty text", () => {
    expect(excerpt("", 140)).toBe("");
  });
});

describe("metaDescription", () => {
  it("uses the description, cut to 160 characters", () => {
    expect(metaDescription("x".repeat(200), 3)).toBe(`${"x".repeat(160)}…`);
    expect(metaDescription("Quals pool", 3)).toBe("Quals pool");
  });

  it("falls back to the map count", () => {
    expect(metaDescription(undefined, 12)).toBe("12 maps. An osu! beatmap pack.");
    expect(metaDescription("", 1)).toBe("1 map. An osu! beatmap pack.");
  });
});

describe("escapeRegExp", () => {
  it("escapes every regex metacharacter", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a literal "${" is the point of this input.
    const text = "a.b*c+?^${}()|[]\\";
    expect(new RegExp(escapeRegExp(text)).test(text)).toBe(true);
    expect(new RegExp(escapeRegExp("a.b")).test("axb")).toBe(false);
  });
});
