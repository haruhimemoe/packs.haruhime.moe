/**
 * @file src/hooks/usePackDownloads.ts
 * @desc Everything the Download card needs to download a pack's sets once and hand the same blobs
 *       to the zip and the torrent: meta readiness, per-set status, progress rows, the download
 *       options, and the plan.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { slotLabel } from "@haruhimemoe/pool";
import type { ProgressRow } from "@/components/export/DownloadProgress";
import type { MetaState } from "@/hooks/beatmapMetaState";
import { useDownloadQueue } from "@/hooks/useDownloadQueue";
import { DEFAULT_FETCH_DEPS, type FetchSetsDeps, type SetStatus } from "@/lib/downloads/fetch-sets";
import { DEFAULT_DOWNLOAD_CHOICES, type DownloadChoices } from "@/schemas/download-choices";
import { type Pool, slotKey } from "@/schemas/pack";
import { type ArchivePlan, planArchive } from "@/utils/pack-archive";

export type PackDownloadsInput = {
  pack: Pool;
  packKey: string;
  getMeta: (beatmapId: number) => MetaState;
  /** Include videos / include backgrounds. Default: no videos, backgrounds kept. */
  choices?: DownloadChoices;
  /** Downloader + cache; keep the reference stable (the default is). */
  deps?: FetchSetsDeps;
};

export type PackDownloads = {
  loading: boolean;
  metaError: boolean;
  missing: number;
  setIds: readonly number[];
  blobs: ReadonlyMap<number, Blob>;
  failedIds: readonly number[];
  failedSlots: number;
  /** Slots whose set is included with its backgrounds because removal failed. */
  backgroundsKeptSlots: number;
  settled: boolean;
  started: boolean;
  running: boolean;
  rows: ProgressRow[];
  statuses: ReadonlyMap<number, SetStatus>;
  downloadRemaining(): void;
  retryFailed(): void;
  cancel(): void;
  /** Stop and forget every download (the options changed). */
  reset(): void;
  /** Browser-only (uses window.location.origin); call once settled. */
  plan(): ArchivePlan;
};

/**
 * @function usePackDownloads
 * @param input {PackDownloadsInput} pack, its key, metadata lookup, download options, deps (tests)
 * @returns {PackDownloads}
 */
export const usePackDownloads = ({
  pack,
  packKey,
  getMeta,
  choices = DEFAULT_DOWNLOAD_CHOICES,
  deps = DEFAULT_FETCH_DEPS,
}: PackDownloadsInput): PackDownloads => {
  const queue = useDownloadQueue(deps);

  const states = pack.slots.map((slot) => ({ slot, state: getMeta(slot.beatmapId) }));
  const loading = states.some(({ state }) => state.status === "loading");
  const metaError = states.some(({ state }) => state.status === "error");
  const missing = states.filter(({ state }) => state.status === "missing").length;
  const found = states.flatMap(({ slot, state }) =>
    state.status === "found" ? [{ slot, meta: state.meta }] : [],
  );
  const setIds = [...new Set(found.map(({ meta }) => meta.beatmapsetId))];

  const blobs = new Map<number, Blob>();
  const failedIds: number[] = [];
  const keptIds = new Set<number>();
  for (const setId of setIds) {
    const status = queue.statuses.get(setId);
    if (status?.status === "ready") {
      blobs.set(setId, status.blob);
      if (status.backgroundsKept) keptIds.add(setId);
    }
    if (status?.status === "failed") failedIds.push(setId);
  }
  const settled = setIds.length > 0 && blobs.size + failedIds.length === setIds.length;
  const failedSlots = found.filter(({ meta }) => failedIds.includes(meta.beatmapsetId)).length;
  const backgroundsKeptSlots = found.filter(({ meta }) => keptIds.has(meta.beatmapsetId)).length;
  const started = setIds.some((setId) => queue.statuses.has(setId));

  const rows: ProgressRow[] = found.map(({ slot, meta }) => ({
    key: slotKey(slot),
    label: slotLabel(slot),
    title: `${meta.artist} - ${meta.title}`,
    setId: meta.beatmapsetId,
  }));

  const plan = (): ArchivePlan =>
    planArchive({
      pack,
      packKey,
      siteUrl: window.location.origin,
      getMeta: (beatmapId): BeatmapMeta | null => {
        const state = getMeta(beatmapId);
        return state.status === "found" ? state.meta : null;
      },
      failedSetIds: new Set(failedIds),
      choices,
      backgroundsKeptSetIds: keptIds,
    });

  return {
    loading,
    metaError,
    missing,
    setIds,
    blobs,
    failedIds,
    failedSlots,
    backgroundsKeptSlots,
    settled,
    started,
    running: queue.running,
    rows,
    statuses: queue.statuses,
    downloadRemaining: () =>
      queue.start(
        setIds.filter((setId) => !blobs.has(setId)),
        choices,
      ),
    retryFailed: () => queue.start(failedIds, choices),
    cancel: queue.cancel,
    reset: queue.reset,
    plan,
  };
};
