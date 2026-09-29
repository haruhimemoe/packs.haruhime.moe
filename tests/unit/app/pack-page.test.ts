/**
 * @file tests/unit/app/pack-page.test.ts
 * @desc /p/[slug] is cookie-free ISR: no build-time params, a one-day safety net, and it asks the
 *       service as an anonymous viewer (owners get their view in the browser). A missing pack is
 *       titled "not found"; a found one renders with the mirror's map info and its JSON-LD.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

const { getPackForViewer } = vi.hoisted(() => ({ getPackForViewer: vi.fn() }));
vi.mock("@/services/pack-reads", () => ({ getPackForViewer }));
// The mirror lookup (and the osu! client behind its module) isn't under test here.
const { lookupPageMeta } = vi.hoisted(() => ({ lookupPageMeta: vi.fn(async () => []) }));
vi.mock("@/lib/pack-stats", () => ({ lookupPageMeta }));

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

  it("titles a missing pack as not found, kept out of search", async () => {
    getPackForViewer.mockResolvedValueOnce(null);
    const page = await import("@/app/(public)/p/[slug]/page");
    const meta = await page.generateMetadata({
      params: Promise.resolve({ slug: "zzzzzzzzzz" }),
    } as never);
    expect(meta).toEqual({
      title: { absolute: "Pack not found · packs.haruhime.moe" },
      robots: { index: false, follow: false },
    });
  });

  it("renders with the maps the mirror knew and the pack's JSON-LD", async () => {
    const pack = {
      name: "SPC Finals",
      slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
      slug: "abcdefghij",
      visibility: "public",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    };
    const known = [{ beatmapId: 129891 }];
    getPackForViewer.mockResolvedValueOnce({ pack, isOwner: false });
    lookupPageMeta.mockResolvedValueOnce(known as never);
    const page = await import("@/app/(public)/p/[slug]/page");
    const tree = (await page.default({
      params: Promise.resolve({ slug: "abcdefghij" }),
    } as never)) as { props: { children: { props: Record<string, unknown> }[] } };
    expect(lookupPageMeta).toHaveBeenCalledWith([129891]);
    const [view, ld] = tree.props.children;
    expect(view?.props.initialMeta).toBe(known);
    expect(ld?.props.data).toMatchObject({ "@graph": [{ "@type": "CreativeWork" }, {}] });
  });
});
