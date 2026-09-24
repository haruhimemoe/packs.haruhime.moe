/**
 * @file tests/unit/constants/site.test.ts
 * @desc Guards the site constants other components and legal pages depend on.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { NAV_LINKS, SERVER_USER_AGENT, SITE } from "@/constants/site";

describe("SITE", () => {
  it("carries the verbatim ppy trademark notice", () => {
    expect(SITE.trademarkNotice).toBe(
      "Not affiliated with or endorsed by ppy Pty Ltd. osu! is a trademark of ppy Pty Ltd.",
    );
  });

  it("has an https site URL and a contact email", () => {
    expect(new URL(SITE.url).protocol).toBe("https:");
    expect(SITE.contactEmail).toMatch(/^[^@\s]+@[^@\s]+\.[a-z]+$/);
  });

  it("builds the server User-Agent from the site name, URL, and contact email", () => {
    expect(SERVER_USER_AGENT).toBe(
      "packs.haruhime.moe (+https://packs.haruhime.moe; contact@haruhime.moe)",
    );
    expect(SERVER_USER_AGENT).toBe(`${SITE.title} (+${SITE.url}; ${SITE.contactEmail})`);
  });
});

describe("NAV_LINKS", () => {
  it("uses internal absolute paths with unique hrefs", () => {
    const hrefs = NAV_LINKS.map((l) => l.href);
    expect(hrefs.every((h) => h.startsWith("/"))).toBe(true);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });
});
