/**
 * @file tests/components/hooks/useDownloadQueue.test.tsx
 * @desc useDownloadQueue: runs fetchSets, merges results, cancel and unmount abort downloads.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDownloadQueue } from "@/hooks/useDownloadQueue";
import type { FetchSetsDeps } from "@/lib/downloads/fetch-sets";
import { LOCAL_DATA_CLEARING_EVENT } from "@/lib/storage/local-data";

const makeDeps = (hang = false, onDisk = false) => {
  const downloads: number[] = [];
  const signals: (AbortSignal | undefined)[] = [];
  const deps: FetchSetsDeps = {
    downloader: {
      getAvailability: async () => ({ downloadable: true, reason: null }),
      downloadSet: (setId, { signal } = {}) => {
        downloads.push(setId);
        signals.push(signal);
        if (!hang) return Promise.resolve(new Blob([`set ${setId}`]));
        return new Promise<Blob>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(signal.reason));
        });
      },
    },
    cache: {
      get: async () => null,
      // onDisk: like OPFS, hand back a disk-backed File instead of the downloaded Blob.
      put: async (setId, blob) => (onDisk ? new File([blob], `${setId}n.osz`) : blob),
      clear: async () => undefined,
    },
    sleep: async () => undefined,
  };
  return { deps, downloads, signals };
};

describe("useDownloadQueue", () => {
  it("downloads the given sets and reports each as ready", async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1, 2]));
    expect(result.current.running).toBe(true);
    await waitFor(() => expect(result.current.running).toBe(false));
    expect(result.current.statuses.get(1)?.status).toBe("ready");
    expect(result.current.statuses.get(2)?.status).toBe("ready");
  });

  it("fetches only what it's asked for and keeps earlier results", async () => {
    const { deps, downloads } = makeDeps();
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1]));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("ready"));
    act(() => result.current.start([2]));
    await waitFor(() => expect(result.current.statuses.get(2)?.status).toBe("ready"));
    expect(result.current.statuses.get(1)?.status).toBe("ready");
    expect(downloads).toEqual([1, 2]);
  });

  it("cancel aborts the download and puts the set back in the queue", async () => {
    const { deps, signals } = makeDeps(true);
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1]));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("downloading"));
    act(() => result.current.cancel());
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.running).toBe(false);
    expect(result.current.statuses.get(1)).toEqual({ status: "queued" });
  });

  it("aborts downloads when the component goes away", async () => {
    const { deps, signals } = makeDeps(true);
    const { result, unmount } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1]));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("downloading"));
    unmount();
    expect(signals[0]?.aborted).toBe(true);
  });

  it("forgets downloads kept in browser storage once local data is cleared", async () => {
    const { deps } = makeDeps(false, true);
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1]));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("ready"));
    act(() => {
      window.dispatchEvent(new Event(LOCAL_DATA_CLEARING_EVENT));
    });
    expect(result.current.statuses.get(1)).toEqual({ status: "queued" });
  });

  it("keeps in-memory downloads when local data is cleared", async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1]));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("ready"));
    act(() => {
      window.dispatchEvent(new Event(LOCAL_DATA_CLEARING_EVENT));
    });
    expect(result.current.statuses.get(1)?.status).toBe("ready");
  });

  it("stops a running download when local data is cleared", async () => {
    const { deps, signals } = makeDeps(true);
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1]));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("downloading"));
    act(() => {
      window.dispatchEvent(new Event(LOCAL_DATA_CLEARING_EVENT));
    });
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.running).toBe(false);
  });

  it("downloads with the given options", async () => {
    const videos: (boolean | undefined)[] = [];
    const stripped: Blob[] = [];
    const deps: FetchSetsDeps = {
      downloader: {
        getAvailability: async () => ({ downloadable: true, reason: null }),
        downloadSet: async (_setId, { video } = {}) => {
          videos.push(video);
          return new Blob(["osz"]);
        },
      },
      cache: {
        get: async () => null,
        put: async (_setId, blob) => blob,
        clear: async () => undefined,
      },
      stripBackgrounds: async (blob) => {
        stripped.push(blob);
        return new Blob(["without backgrounds"]);
      },
      sleep: async () => undefined,
    };
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1], { videos: true, backgrounds: false }));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("ready"));
    expect(videos).toEqual([true]);
    expect(stripped).toHaveLength(1);
  });

  it("reset stops a running download and forgets every result", async () => {
    const { deps, signals } = makeDeps(true);
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1]));
    await waitFor(() => expect(result.current.statuses.get(1)?.status).toBe("downloading"));
    act(() => result.current.reset());
    expect(signals[0]?.aborted).toBe(true);
    expect(result.current.running).toBe(false);
    expect(result.current.statuses.size).toBe(0);
  });

  it("reset forgets finished downloads too", async () => {
    const { deps } = makeDeps();
    const { result } = renderHook(() => useDownloadQueue(deps));
    act(() => result.current.start([1, 2]));
    await waitFor(() => expect(result.current.running).toBe(false));
    act(() => result.current.reset());
    expect(result.current.statuses.size).toBe(0);
  });
});
