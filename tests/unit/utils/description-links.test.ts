/**
 * @file tests/unit/utils/description-links.test.ts
 * @desc descriptionParts: https:// URLs become links and everything else stays text (http:,
 *       javascript:, a bare scheme, a URL glued to a word, a URL that doesn't parse); punctuation
 *       after a URL, or a bracket around it, stays text, while a ")" the URL opened stays in it;
 *       the parts always give the description back.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type DescriptionPart, descriptionParts } from "@/utils/description-links";

const join = (parts: readonly DescriptionPart[]): string =>
  parts.map((part) => (part.kind === "link" ? part.href : part.text)).join("");

const links = (text: string): string[] =>
  descriptionParts(text).flatMap((part) => (part.kind === "link" ? [part.href] : []));

describe("descriptionParts", () => {
  it("links an https URL and keeps the text around it", () => {
    expect(descriptionParts("Details: https://pools.haruhime.moe/pools/otdb-58 (Ricma)")).toEqual([
      { kind: "text", text: "Details: ", at: 0 },
      { kind: "link", href: "https://pools.haruhime.moe/pools/otdb-58", at: 9 },
      { kind: "text", text: " (Ricma)", at: 49 },
    ]);
  });

  it("links every URL, and a description that is only a URL", () => {
    expect(links("https://a.example/1 and https://b.example/2")).toEqual([
      "https://a.example/1",
      "https://b.example/2",
    ]);
    expect(descriptionParts("https://a.example")).toEqual([
      { kind: "link", href: "https://a.example", at: 0 },
    ]);
  });

  it.each([
    "http://example.com",
    "javascript:alert(1)",
    "https://",
    "HTTPS://EXAMPLE.COM",
    "nothttps://example.com",
    "ftp://example.com",
    "data:text/html,<b>x</b>",
    "https://[oops",
  ])("leaves %j as text", (url) => {
    const text = `see ${url} here`;
    expect(descriptionParts(text)).toEqual([{ kind: "text", text, at: 0 }]);
  });

  it.each([
    ["See https://x.com/a.", "https://x.com/a", "."],
    ["(see https://x.com/a)", "https://x.com/a", ")"],
    ["(see https://x.com/a).", "https://x.com/a", ")."],
    ["https://x.com/a, then more", "https://x.com/a", ", then more"],
    ["Is it https://x.com/a?", "https://x.com/a", "?"],
    ['"https://x.com/a"', "https://x.com/a", '"'],
    ["[https://x.com/a]", "https://x.com/a", "]"],
  ])("stops %j before the punctuation after it", (text, href, after) => {
    expect(links(text)).toEqual([href]);
    expect(descriptionParts(text).at(-1)).toEqual({
      kind: "text",
      text: after,
      at: text.length - after.length,
    });
  });

  it("keeps a closing parenthesis the URL opened itself", () => {
    const url = "https://en.wikipedia.org/wiki/Freedom_(song)";
    expect(descriptionParts(`${url}.`)).toEqual([
      { kind: "link", href: url, at: 0 },
      { kind: "text", text: ".", at: url.length },
    ]);
  });

  it("always gives the description back", () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.constantFrom("", "https://x.example/a", "(https://y.example/(b)).", "http://z.example"),
        fc.string(),
        (before, url, after) => {
          const text = `${before} ${url} ${after}`;
          expect(join(descriptionParts(text))).toBe(text);
        },
      ),
    );
  });
});
