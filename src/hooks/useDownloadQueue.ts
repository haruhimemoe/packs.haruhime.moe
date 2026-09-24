/**
 * @file src/hooks/useDownloadQueue.ts
 * @desc React wrapper around fetchSets: per-set status, start with the download options,
 *       cancel, reset, abort on unmount, and forgetting cached files when local data is cleared.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_FETCH_DEPS,
  type FetchSetsDeps,
  fetchSets,
  type SetStatus,
} from "@/lib/downloads/fetch-sets";
import { LOCAL_DATA_CLEARING_EVENT } from "@/lib/storage/local-data";
import { DEFAULT_DOWNLOAD_CHOICES, type DownloadChoices } from "@/schemas/download-choices";

export type DownloadQueue = {
  statuses: ReadonlyMap<number, SetStatus>;
  running: boolean;
  start(setIds: readonly number[], choices?: DownloadChoices): void;
  cancel(): void;
  /** Stop and forget every result, e.g. when the download options change. */
  reset(): void;
};

/**
 * @function useDownloadQueue
 * @param deps {FetchSetsDeps} downloader + cache; keep the reference stable (defaults are)
 * @returns {DownloadQueue}
 */
export const useDownloadQueue = (deps: FetchSetsDeps = DEFAULT_FETCH_DEPS): DownloadQueue => {
  const [statuses, setStatuses] = useState<ReadonlyMap<number, SetStatus>>(() => new Map());
  const [running, setRunning] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const start = useCallback(
    (setIds: readonly number[], choices: DownloadChoices = DEFAULT_DOWNLOAD_CHOICES) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setRunning(true);
      fetchSets(
        setIds,
        deps,
        (setId, status) => {
          if (controller.signal.aborted) return;
          setStatuses((prev) => new Map(prev).set(setId, status));
        },
        controller.signal,
        choices,
      )
        // fetchSets only rejects on abort; every other failure is a per-set "failed" status.
        .catch(() => undefined)
        .finally(() => {
          if (controllerRef.current !== controller) return;
          controllerRef.current = null;
          setRunning(false);
        });
    },
    [deps],
  );

  /** Abort the run in progress and send every row matched by `forget` back to "queued". */
  const stop = useCallback((forget: (status: SetStatus) => boolean) => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
    setStatuses((prev) => {
      const next = new Map(prev);
      for (const [setId, status] of prev) {
        if (forget(status)) next.set(setId, { status: "queued" });
      }
      return next;
    });
  }, []);

  // Unfinished sets go back to "queued" so no row is left frozen mid-download.
  const cancel = useCallback(
    () => stop((status) => status.status !== "ready" && status.status !== "failed"),
    [stop],
  );

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setRunning(false);
    setStatuses(new Map());
  }, []);

  // "Clear local data" deletes the OPFS files behind ready rows (disk-backed Files), so forget
  // those too; in-memory Blobs are unaffected. Also stops downloads that would re-fill the cache.
  useEffect(() => {
    const onClearing = () =>
      stop((status) =>
        status.status === "ready" ? status.blob instanceof File : status.status !== "failed",
      );
    window.addEventListener(LOCAL_DATA_CLEARING_EVENT, onClearing);
    return () => window.removeEventListener(LOCAL_DATA_CLEARING_EVENT, onClearing);
  }, [stop]);

  return { statuses, running, start, cancel, reset };
};
