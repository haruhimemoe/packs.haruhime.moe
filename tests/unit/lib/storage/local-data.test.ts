/**
 * @file tests/unit/lib/storage/local-data.test.ts
 * @desc clearLocalData deletes the draft, the download cache, the download options and the saved
 *       place in the public pack results, and reports real failures.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { clearLocalData } from "@/lib/storage/local-data";

describe("clearLocalData", () => {
  it("clears the draft and the cache", async () => {
    const clearDraft = vi.fn(async () => undefined);
    const clear = vi.fn(async () => undefined);
    await clearLocalData({ clearDraft, cache: { clear } });
    expect(clearDraft).toHaveBeenCalledOnce();
    expect(clear).toHaveBeenCalledOnce();
  });

  it("rejects when either part fails", async () => {
    const clear = vi.fn(async () => {
      throw new DOMException("nope", "InvalidStateError");
    });
    await expect(
      clearLocalData({ clearDraft: async () => undefined, cache: { clear } }),
    ).rejects.toBeDefined();
  });

  it("succeeds with the real defaults where there is no IndexedDB or OPFS", async () => {
    await expect(clearLocalData()).resolves.toBeUndefined();
  });

  it("tells open pages before deleting anything, so they stop using the files", async () => {
    const order: string[] = [];
    await clearLocalData({
      notify: () => order.push("notify"),
      clearDraft: async () => {
        order.push("draft");
      },
      cache: {
        clear: async () => {
          order.push("cache");
        },
      },
    });
    expect(order[0]).toBe("notify");
    expect(order).toHaveLength(3);
  });

  it("forgets the saved place in the public pack results too", async () => {
    const clearViews = vi.fn();
    await clearLocalData({
      clearDraft: async () => undefined,
      cache: { clear: async () => undefined },
      clearViews,
    });
    expect(clearViews).toHaveBeenCalledOnce();
  });

  it("forgets the saved download options too", async () => {
    const clearChoices = vi.fn();
    await clearLocalData({
      clearDraft: async () => undefined,
      cache: { clear: async () => undefined },
      clearChoices,
    });
    expect(clearChoices).toHaveBeenCalledOnce();
  });
});
