/**
 * @file src/app/.well-known/security.txt/route.ts
 * @desc /.well-known/security.txt (RFC 9116), static: @haruhimemoe/next-kit's body, GitHub private
 *       vulnerability reporting as the preferred Contact, then the email Contact, a year's
 *       Expires, Canonical, and SECURITY.md as the Policy.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Sat Oct 3, 2026
 */

import { buildSecurityTxt } from "@haruhimemoe/next-kit/server";
import { SECURITY_REPORT_URL, SITE } from "@/constants/site";

export const dynamic = "force-static";

/**
 * @function GET
 * @returns {Response} 200 text/plain: the security.txt body, preferred contact first
 */
export function GET(): Response {
  const body = buildSecurityTxt({
    contactEmail: SITE.contactEmail,
    siteUrl: SITE.url,
    policyUrl: `${SITE.repoUrl}/blob/main/SECURITY.md`,
    now: new Date(),
    contactUrl: SECURITY_REPORT_URL,
  });
  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
