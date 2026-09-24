/**
 * @file src/utils/security-txt.ts
 * @desc /.well-known/security.txt (RFC 9116), built from the SITE constants: where to report a
 *       vulnerability, when this file goes stale (a year after it was built), and the policy.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { SITE } from "@/constants/site";

/** RFC 9116 asks for an Expires less than a year out; a deploy rebuilds the file. */
export const SECURITY_TXT_LIFETIME_DAYS = 365;

export const SECURITY_TXT_PATH = "/.well-known/security.txt";

/**
 * @function buildSecurityTxt
 * @param now {Date} when the file is built (build time for the static route)
 * @returns {string} the security.txt body: Contact, Expires, Preferred-Languages, Canonical,
 *          Policy, one field per line, ending in one newline
 */
export const buildSecurityTxt = (now: Date): string => {
  const expires = new Date(now.getTime() + SECURITY_TXT_LIFETIME_DAYS * 86_400_000);
  const lines = [
    `Contact: mailto:${SITE.contactEmail}`,
    `Expires: ${expires.toISOString()}`,
    "Preferred-Languages: en",
    `Canonical: ${SITE.url}${SECURITY_TXT_PATH}`,
    `Policy: ${SITE.repoUrl}/blob/main/SECURITY.md`,
  ];
  return `${lines.join("\n")}\n`;
};
