/**
 * @file tests/unit/app/pack-page.test.ts
 * @desc /p/[slug] is cookie-free ISR: no build-time params, a one-day safety net, and it asks the
 *       service as an anonymous viewer (owners get their view in the browser).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const { getPackForViewer } = vi.hoisted(() => ({ getPackForViewer: vi.fn() }));
vi.mock("@/services/packs", () => ({ getPackForViewer }));

const FILE = path.join(process.cwd(), "src/app/(public)/p/[slug]/page.tsx");

describe("/p/[slug] page", () => {
  it("is ISR with no build-time params and a one-day safety net", async () => {
    const page = await import("@/app/(public)/p/[slug]/page");
    expect(page.revalidate).toBe(86_400);
    expect(page.generateStaticParams()).toEqual([]);
  });

  it("reads no cookies or headers", () => {
    const source = readFileSync(FILE, "utf8");
    expect(source).not.toMatch(/next\/headers|getCurrentUser|cookies\(/);
  });

  it("loads the pack as an anonymous viewer", async () => {
    getPackForViewer.mockResolvedValueOnce(null);
    const page = await import("@/app/(public)/p/[slug]/page");
    await page.generateMetadata({ params: Promise.resolve({ slug: "abcdefghij" }) } as never);
    expect(getPackForViewer).toHaveBeenCalledWith("abcdefghij", null);
  });
});
