/**
 * @file src/app/.well-known/security.txt/route.ts
 * @desc GET /.well-known/security.txt (RFC 9116). Static: built on deploy, so Expires is a year
 *       from the last deploy.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { buildSecurityTxt } from "@/utils/security-txt";

export const dynamic = "force-static";

export function GET() {
  return new Response(buildSecurityTxt(new Date()), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
