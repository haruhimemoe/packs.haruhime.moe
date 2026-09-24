/**
 * @file tests/components/hooks/useSearchIndex.test.tsx
 * @desc useSearchIndex: nothing loads until asked; one load at a time; after a failure only
 *       retry fetches again; a loaded index is kept for the tab, so coming back to /packs has it
 *       at once, for INDEX_REUSE_MS; a failed load is never kept.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { INDEX_REUSE_MS } from "@/constants/pack-filters";
import { useSearchIndex } from "@/hooks/useSearchIndex";
import type { SearchIndex } from "@/schemas/public-pack";

const INDEX: SearchIndex = {
  v: 1,
  packs: [{ s: "aaaaaaaaaa", n: "Cup", o: "Chiyo", c: 3, d: "", u: "2026-09-22T00:00:00.000Z" }],
};

afterEach(() => {
  vi.useRealTimers();
});

describe("useSearchIndex", () => {
  it("loads nothing until asked, then once", async () => {
    const loadIndex = vi.fn(async () => INDEX);
    const { result } = renderHook(() => useSearchIndex(loadIndex));
    expect(result.current.state).toEqual({ status: "idle" });
    expect(loadIndex).not.toHaveBeenCalled();
    act(() => {
      result.current.load();
      result.current.load();
    });
    await waitFor(() => expect(result.current.state).toEqual({ status: "ready", index: INDEX }));
    act(() => result.current.load());
    expect(loadIndex).toHaveBeenCalledOnce();
  });

  it("after a failure, loads again only on retry", async () => {
    const loadIndex = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(INDEX);
    const { result } = renderHook(() => useSearchIndex(loadIndex));
    act(() => result.current.load());
    await waitFor(() => expect(result.current.state).toEqual({ status: "error" }));
    expect(result.current.failures).toBe(1);
    act(() => result.current.load());
    expect(loadIndex).toHaveBeenCalledOnce();
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe("ready"));
    expect(result.current.failures).toBe(0);
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });

  it("gives a later mount the loaded index at once, without fetching again", async () => {
    const loadIndex = vi.fn(async () => INDEX);
    const first = renderHook(() => useSearchIndex(loadIndex));
    act(() => first.result.current.load());
    await waitFor(() => expect(first.result.current.state.status).toBe("ready"));
    first.unmount();

    const again = renderHook(() => useSearchIndex(loadIndex));
    expect(again.result.current.state).toEqual({ status: "ready", index: INDEX });
    act(() => again.result.current.load());
    expect(loadIndex).toHaveBeenCalledOnce();
  });

  it("fetches again once the kept index is older than INDEX_REUSE_MS", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const loadIndex = vi.fn(async () => INDEX);
    const first = renderHook(() => useSearchIndex(loadIndex));
    act(() => first.result.current.load());
    await waitFor(() => expect(first.result.current.state.status).toBe("ready"));
    first.unmount();

    vi.setSystemTime(Date.now() + INDEX_REUSE_MS + 1);
    const again = renderHook(() => useSearchIndex(loadIndex));
    expect(again.result.current.state).toEqual({ status: "idle" });
    act(() => again.result.current.load());
    await waitFor(() => expect(again.result.current.state.status).toBe("ready"));
    expect(loadIndex).toHaveBeenCalledTimes(2);
  });

  it("never keeps a failed load", async () => {
    const loadIndex = vi.fn().mockRejectedValue(new Error("offline"));
    const first = renderHook(() => useSearchIndex(loadIndex));
    act(() => first.result.current.load());
    await waitFor(() => expect(first.result.current.state.status).toBe("error"));
    first.unmount();
    expect(renderHook(() => useSearchIndex(loadIndex)).result.current.state).toEqual({
      status: "idle",
    });
  });
});
