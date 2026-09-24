/**
 * @file src/lib/downloads/fetch-sets.ts
 * @desc Gets every beatmapset in a pool as a Blob: OPFS cache first, then an availability check and
 *       a download from the hinai mirror (@haruhimemoe/hinai), 4 at a time, retrying what the
 *       mirror client calls retryable (429, 5xx, timeouts, network) with backoff (honoring
 *       Retry-After). Follows the download options: the video variant has its own URL and
 *       cache name, and with backgrounds off they're removed in the browser after the cache read and
 *       the result is cached under its own name. Reports per-set status as it goes. Never touches
 *       our server.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { HinaiClient } from "@haruhimemoe/hinai";
import { backoffDelayMs, HinaiError, mirror, mirrorErrorText } from "@/lib/mirror";
import { type OszCache, oszCache } from "@/lib/storage/osz-cache";
import { DEFAULT_DOWNLOAD_CHOICES, type DownloadChoices } from "@/schemas/download-choices";
import { oneAtATime, runPool } from "@/utils/task-pool";

export const DOWNLOAD_CONCURRENCY = 4;
export const MAX_ATTEMPTS = 4;

export type SetStatus =
  | { status: "queued" }
  | { status: "checking" }
  | { status: "downloading"; loaded: number; total: number | null; attempt: number }
  | { status: "waiting"; retryInMs: number; attempt: number }
  | { status: "removing" }
  | { status: "ready"; blob: Blob; fromCache: boolean; backgroundsKept?: true }
  | { status: "failed"; message: string; retryable: boolean };

/** Removes background images from one .osz; rejects when the archive can't be rewritten. */
export type StripBackgrounds = (blob: Blob, signal?: AbortSignal) => Promise<Blob>;

export type FetchSetsDeps = {
  /** Default: the app's hinai mirror client. */
  downloader: Pick<HinaiClient, "getAvailability" | "downloadSet">;
  cache: OszCache;
  /** Default: stripBackgroundsInBrowser. */
  stripBackgrounds?: StripBackgrounds;
  concurrency?: number;
  maxAttempts?: number;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
};

/**
 * fflate loads only once someone turns backgrounds off. One set at a time: a rewrite holds the set
 * in memory about twice over (the set and its rewritten copy), and four big sets at once could run
 * a tab out of memory.
 */
export const stripBackgroundsInBrowser: StripBackgrounds = oneAtATime(
  async (blob: Blob, signal?: AbortSignal): Promise<Blob> => {
    signal?.throwIfAborted();
    const { stripBackgrounds } = await import("@/lib/osz/strip-backgrounds");
    return stripBackgrounds(blob, { signal });
  },
);

export const DEFAULT_FETCH_DEPS: FetchSetsDeps = {
  downloader: mirror,
  cache: oszCache,
  stripBackgrounds: stripBackgroundsInBrowser,
};

const FALLBACK_MESSAGE = "Something went wrong downloading this set. Try again.";
const INTERRUPTED_MESSAGE = "The download was interrupted. Try again.";
const NOT_DOWNLOADABLE_MESSAGE = "The mirror doesn't have this beatmapset.";

/**
 * The text a failed set shows: mirrorErrorText, except a download that broke off after bytes
 * arrived says so, and a 404 on the download itself (the availability check passed) keeps its own
 * wording.
 */
const failureMessage = (error: unknown, downloading: boolean, receiving: boolean): string => {
  if (error instanceof HinaiError) {
    if (error.code === "network" && receiving) return INTERRUPTED_MESSAGE;
    if (error.code === "not_found" && downloading) return NOT_DOWNLOADABLE_MESSAGE;
  }
  return mirrorErrorText(error, FALLBACK_MESSAGE);
};

/**
 * @function abortableSleep
 * @param ms {number} delay
 * @param signal {AbortSignal} rejects with the signal's reason when aborted
 * @returns {Promise<void>}
 */
export const abortableSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

const disabledMessage = (reason: string | null): string =>
  reason
    ? `The mirror can't serve this set: ${reason}`
    : "The mirror can't serve this set right now.";

/**
 * @function fetchSets
 * @param setIds {readonly number[]} beatmapset ids (duplicates fine)
 * @param deps {FetchSetsDeps} downloader, cache, background remover, tuning (injectable for tests)
 * @param onUpdate {(setId, status) => void} called on every status change
 * @param signal {AbortSignal} cancels everything
 * @param choices {DownloadChoices} include videos / include backgrounds
 * @returns {Promise<Map<number, SetStatus>>} final status per set: ready or failed
 * @throws the signal's reason (AbortError) when aborted; nothing else
 */
export const fetchSets = async (
  setIds: readonly number[],
  deps: FetchSetsDeps,
  onUpdate: (setId: number, status: SetStatus) => void,
  signal?: AbortSignal,
  choices: DownloadChoices = DEFAULT_DOWNLOAD_CHOICES,
): Promise<Map<number, SetStatus>> => {
  const {
    downloader,
    cache,
    stripBackgrounds = stripBackgroundsInBrowser,
    concurrency = DOWNLOAD_CONCURRENCY,
    maxAttempts = MAX_ATTEMPTS,
    sleep = abortableSleep,
  } = deps;
  const video = choices.videos;
  const results = new Map<number, SetStatus>();
  const report = (setId: number, status: SetStatus) => {
    results.set(setId, status);
    onUpdate(setId, status);
  };
  const unique = [...new Set(setIds)];
  for (const setId of unique) report(setId, { status: "queued" });

  const download = async (setId: number): Promise<SetStatus> => {
    const cached = await cache.get(setId, { video });
    if (cached) return { status: "ready", blob: cached, fromCache: true };

    let checked = false;
    for (let attempt = 1; ; attempt++) {
      // Whether this attempt's archive had started arriving (the package reports progress only
      // once the first bytes are known to be a zip).
      let receiving = false;
      try {
        if (!checked) {
          report(setId, { status: "checking" });
          const availability = await downloader.getAvailability(setId, { signal });
          if (!availability.downloadable) {
            return {
              status: "failed",
              message: disabledMessage(availability.reason),
              retryable: false,
            };
          }
          checked = true;
        }
        report(setId, { status: "downloading", loaded: 0, total: null, attempt });
        const blob = await downloader.downloadSet(setId, {
          signal,
          video,
          onProgress: ({ loaded, total }) => {
            receiving = true;
            report(setId, { status: "downloading", loaded, total, attempt });
          },
        });
        return { status: "ready", blob: await cache.put(setId, blob, { video }), fromCache: false };
      } catch (error) {
        if (signal?.aborted) throw signal.reason;
        const failure = error instanceof HinaiError ? error : null;
        const retryable = failure?.retryable ?? false;
        if (!failure || !retryable || attempt >= maxAttempts) {
          return {
            status: "failed",
            message: failureMessage(error, checked, receiving),
            retryable,
          };
        }
        const wait = backoffDelayMs(attempt, failure.retryAfterMs);
        report(setId, { status: "waiting", retryInMs: wait, attempt });
        await sleep(wait, signal);
      }
    }
  };

  // Removal runs after the cache read, so the mirror-file names always hold the mirror's file. The
  // rewritten set is cached under its own name and handed on as that disk-backed File (without
  // OPFS, put hands back the in-memory blob).
  const fetchOne = async (setId: number): Promise<SetStatus> => {
    const stripped = { video, noBackgrounds: true };
    if (!choices.backgrounds) {
      const cached = await cache.get(setId, stripped);
      if (cached) return { status: "ready", blob: cached, fromCache: true };
    }
    const result = await download(setId);
    if (result.status !== "ready" || choices.backgrounds) return result;
    report(setId, { status: "removing" });
    let blob: Blob;
    try {
      blob = await stripBackgrounds(result.blob, signal);
    } catch {
      if (signal?.aborted) throw signal.reason;
      // A set we can't rewrite still works: it goes in as the mirror sent it.
      return { ...result, backgroundsKept: true };
    }
    // Nothing to remove: the mirror's file is already the answer.
    if (blob === result.blob) return result;
    return { ...result, blob: await cache.put(setId, blob, stripped) };
  };

  await runPool(unique, concurrency, async (setId) => {
    if (signal?.aborted) throw signal.reason;
    report(setId, await fetchOne(setId));
  });
  if (signal?.aborted) throw signal.reason;
  return results;
};
