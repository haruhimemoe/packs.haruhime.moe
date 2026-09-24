/**
 * @file tests/unit/utils/security-txt.test.ts
 * @desc security.txt: the RFC 9116 fields in order, built from SITE, Expires a year after the
 *       build, one trailing newline.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { SITE } from "@/constants/site";
import { buildSecurityTxt, SECURITY_TXT_PATH } from "@/utils/security-txt";

const NOW = new Date("2026-09-23T00:00:00.000Z");

describe("buildSecurityTxt", () => {
  it("writes the five fields in order", () => {
    expect(buildSecurityTxt(NOW)).toBe(
      [
        "Contact: mailto:contact@haruhime.moe",
        "Expires: 2027-09-23T00:00:00.000Z",
        "Preferred-Languages: en",
        "Canonical: https://packs.haruhime.moe/.well-known/security.txt",
        "Policy: https://github.com/haruhimemoe/packs.haruhime.moe/blob/main/SECURITY.md",
        "",
      ].join("\n"),
    );
  });

  it("builds Contact, Canonical and Policy from SITE", () => {
    const text = buildSecurityTxt(NOW);
    expect(text).toContain(`Contact: mailto:${SITE.contactEmail}\n`);
    expect(text).toContain(`Canonical: ${SITE.url}${SECURITY_TXT_PATH}\n`);
    expect(text).toContain(`Policy: ${SITE.repoUrl}/blob/main/SECURITY.md\n`);
  });

  it("expires exactly 365 days after now, in ISO 8601 UTC", () => {
    const now = new Date("2028-02-29T13:45:10.123Z");
    const expires = buildSecurityTxt(now).match(/^Expires: (.+)$/m)?.[1] ?? "";
    expect(expires).toBe(new Date(now.getTime() + 365 * 86_400_000).toISOString());
    expect(expires).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("ends with exactly one newline", () => {
    const text = buildSecurityTxt(NOW);
    expect(text.endsWith("\n")).toBe(true);
    expect(text.endsWith("\n\n")).toBe(false);
  });
});
