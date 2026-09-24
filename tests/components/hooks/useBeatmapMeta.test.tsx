/**
 * @file tests/components/hooks/useBeatmapMeta.test.tsx
 * @desc useBeatmapMeta against a fake client: found/missing, no refetching, error then retry, and
 *       ids osu! couldn't check yet (unchecked) retryable as errors, never missing, mirror errors
 *       in plain words (no status codes), and lookups aborted once they're no longer wanted.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useBeatmapMeta } from "@/hooks/useBeatmapMeta";
import type { BeatmapSource } from "@/lib/beatmaps/lookup";
import { HinaiError } from "@/lib/mirror";

const meta = (id: number): BeatmapMeta => ({
  beatmapId: id,
  beatmapsetId: id + 1000,
  mode: "osu",
  title: `t${id}`,
  artist: "a",
  version: "v",
  creator: "c",
  creatorId: null,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5,
  checksum: null,
});

/**
 * Knows ids 1 and 2; records every call; can be told to fail the next call, or to leave the next
 * call's ids unchecked (osu!'s budget was spent).
 */
const fakeClient = () => {
  const calls: number[][] = [];
  let failNext: Error | null = null;
  let uncheckNext = false;
  const client: BeatmapSource = {
    async getBeatmaps(ids) {
      calls.push([...ids]);
      if (failNext) {
        const error = failNext;
        failNext = null;
        throw error;
      }
      if (uncheckNext) {
        uncheckNext = false;
        return { found: new Map(), missing: [], unchecked: [...ids] };
      }
      const found = new Map(ids.filter((id) => id <= 2).map((id) => [id, meta(id)]));
      return { found, missing: ids.filter((id) => id > 2) };
    },
  };
  return {
    client,
    calls,
    failNextCall: (
      error: Error = new HinaiError("network", "Couldn't reach the beatmap mirror.", {
        retryable: true,
      }),
    ) => (failNext = error),
    uncheckNextCall: () => (uncheckNext = true),
  };
};

describe("useBeatmapMeta", () => {
  it("resolves found and missing ids", async () => {
    const { client } = fakeClient();
    const { result } = renderHook(() => useBeatmapMeta([1, 3], client));
    expect(result.current.get(1)).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current.get(1).status).toBe("found"));
    expect(result.current.get(3)).toEqual({ status: "missing" });
  });

  it("only fetches ids it hasn't seen", async () => {
    const { client, calls } = fakeClient();
    const { result, rerender } = renderHook(({ ids }) => useBeatmapMeta(ids, client), {
      initialProps: { ids: [1] },
    });
    await waitFor(() => expect(result.current.get(1).status).toBe("found"));
    rerender({ ids: [1, 2] });
    await waitFor(() => expect(result.current.get(2).status).toBe("found"));
    rerender({ ids: [2, 1, 1] });
    expect(calls).toEqual([[1], [2]]);
  });

  it("shows the error per slot and recovers on retry", async () => {
    const { client, failNextCall } = fakeClient();
    failNextCall();
    const { result } = renderHook(() => useBeatmapMeta([1], client));
    await waitFor(() => expect(result.current.get(1).status).toBe("error"));
    expect(result.current.hasErrors).toBe(true);
    expect(result.current.get(1)).toEqual({
      status: "error",
      message: "Couldn't reach the beatmap mirror. Check your connection and try again.",
    });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.get(1).status).toBe("found"));
    expect(result.current.hasErrors).toBe(false);
  });

  it("says a mirror error status in plain words, without the status code", async () => {
    const { client, failNextCall } = fakeClient();
    failNextCall(
      new HinaiError("http_error", "The beatmap mirror answered 503.", {
        status: 503,
        retryable: true,
      }),
    );
    const { result } = renderHook(() => useBeatmapMeta([1], client));
    await waitFor(() => expect(result.current.get(1).status).toBe("error"));
    expect(result.current.get(1)).toEqual({
      status: "error",
      message: "The beatmap mirror had a problem. Try again in a minute.",
    });
  });

  it("keeps its own text for an error that isn't the mirror's", async () => {
    const { client, failNextCall } = fakeClient();
    failNextCall(new TypeError("boom"));
    const { result } = renderHook(() => useBeatmapMeta([1], client));
    await waitFor(() => expect(result.current.get(1).status).toBe("error"));
    expect(result.current.get(1)).toEqual({
      status: "error",
      message: "Something went wrong loading beatmaps. Try again.",
    });
  });

  it("marks ids osu! couldn't check yet as errors, not missing, and asks again on retry", async () => {
    const { client, calls, uncheckNextCall } = fakeClient();
    uncheckNextCall();
    const { result } = renderHook(() => useBeatmapMeta([1], client));
    await waitFor(() => expect(result.current.get(1).status).toBe("error"));
    expect(result.current.hasErrors).toBe(true);
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.get(1).status).toBe("found"));
    expect(calls).toEqual([[1], [1]]);
    expect(result.current.hasErrors).toBe(false);
  });

  it("aborts a lookup it no longer needs when unmounted", async () => {
    const signals: (AbortSignal | undefined)[] = [];
    const client: BeatmapSource = {
      getBeatmaps: (_ids, { signal } = {}) => {
        signals.push(signal);
        return new Promise(() => undefined);
      },
    };
    const { unmount } = renderHook(() => useBeatmapMeta([1], client));
    await waitFor(() => expect(signals).toHaveLength(1));
    expect(signals[0]?.aborted).toBe(false);
    unmount();
    expect(signals[0]?.aborted).toBe(true);
  });
});
