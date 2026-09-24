/**
 * @file tests/unit/utils/doc-markdown.test.ts
 * @desc A doc's Markdown copy: an H1 only when the source has none, absolute site links, other
 *       links and code untouched, one trailing newline.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { SITE } from "@/constants/site";
import { docMarkdown, docMarkdownPath } from "@/utils/doc-markdown";

describe("docMarkdownPath", () => {
  it("is the doc URL with .md", () => {
    expect(docMarkdownPath("api")).toBe("/docs/api.md");
  });
});

describe("docMarkdown", () => {
  it("adds the title as an H1 when the source has none", () => {
    expect(docMarkdown("packs API", "Intro.\n\n## Quick start\n")).toBe(
      "# packs API\n\nIntro.\n\n## Quick start\n",
    );
  });

  it("keeps the source's own H1", () => {
    expect(docMarkdown("packs API", "# Own title\n\nBody\n")).toBe("# Own title\n\nBody\n");
  });

  it("doesn't mistake a '# ' line inside a code fence for an H1", () => {
    const body = "Intro.\n\n```sh\n# install\n```\n";
    expect(docMarkdown("packs API", body)).toBe(`# packs API\n\n${body.trimEnd()}\n`);
  });

  it("makes root-relative links absolute, on SITE.url by default", () => {
    expect(docMarkdown("T", "[account](/me) and [key](/guide/pack-key#v1)")).toBe(
      `# T\n\n[account](${SITE.url}/me) and [key](${SITE.url}/guide/pack-key#v1)\n`,
    );
    expect(docMarkdown("T", "[a](/b)", "https://example.com")).toBe(
      "# T\n\n[a](https://example.com/b)\n",
    );
  });

  it("leaves absolute, protocol-relative and in-page links alone", () => {
    const body = "[x](https://a.example/b) [y](//cdn.example/c) [z](#rate-limits) `/api/v1`";
    expect(docMarkdown("T", body)).toBe(`# T\n\n${body}\n`);
  });

  it("normalizes line endings and ends with exactly one newline", () => {
    const out = docMarkdown("T", "\r\nA\r\nB\n\n\n");
    expect(out).toBe("# T\n\nA\nB\n");
  });
});
