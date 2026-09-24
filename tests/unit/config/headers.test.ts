/**
 * @file tests/unit/config/headers.test.ts
 * @desc Security headers on every route (no framing, no MIME sniffing, a trimmed Referer) and no
 *       X-Powered-By.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import nextConfig from "../../../next.config";

const catchAll = async () => {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((entry) => entry.source === "/:path*");
  return Object.fromEntries((rule?.headers ?? []).map(({ key, value }) => [key, value]));
};

describe("security headers", () => {
  it("sends the security headers on every route", async () => {
    expect(await catchAll()).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "frame-ancestors 'none'",
    });
  });

  it("doesn't advertise Next.js", () => {
    expect(nextConfig.poweredByHeader).toBe(false);
  });
});
