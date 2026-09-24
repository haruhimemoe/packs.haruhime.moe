/**
 * @file tests/unit/lib/downloads/fetch-sets.test.ts
 * @desc fetchSets: cache first, dedupe, concurrency cap, retry with Retry-After, give-up, disabled
 *       sets, progress, abort, failure text per error code, download options (video variant,
 *       background removal), and the same flows through the real mirror client against MSW.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { unzipSync } from "fflate";
import { HttpResponse, http } from "msw";
import { describe, expect, it, vi } from "vitest";
import {
  abortableSleep,
  DEFAULT_FETCH_DEPS,
  type FetchSetsDeps,
  fetchSets,
  type SetStatus,
} from "@/lib/downloads/fetch-sets";
import { HinaiError, mirror } from "@/lib/mirror";
import { OszRewriteError } from "@/lib/osz/zip-names";
import { cacheFileName, createOszCache, type OszCache } from "@/lib/storage/osz-cache";
import {
  fakeOsz,
  HINAI_AVAILABILITY_URL,
  HINAI_DOWNLOAD_URL,
  hinaiUnknownSetHandler,
} from "../../../helpers/hinai-downloads";
import { setupHinaiServer } from "../../../helpers/hinai-server";
import { makeOsz, makeStreamedOsz, noise, osuFile } from "../../../helpers/osz-fixtures";

const server = setupHinaiServer();

const fakeDownloader = (
  options: { disabled?: Record<number, string | null>; script?: Record<number, Error[]> } = {},
) => {
  const checks: number[] = [];
  const checkSignals: (AbortSignal | undefined)[] = [];
  const downloads: number[] = [];
  let inFlight = 0;
  let peak = 0;
  const downloader: FetchSetsDeps["downloader"] = {
    getAvailability: async (setId, { signal } = {}) => {
      checks.push(setId);
      checkSignals.push(signal);
      const reason = options.disabled?.[setId];
      return reason === undefined
        ? { downloadable: true, reason: null }
        : { downloadable: false, reason };
    },
    downloadSet: async (setId, { signal, onProgress } = {}) => {
      downloads.push(setId);
      inFlight++;
      peak = Math.max(peak, inFlight);
      try {
        await new Promise((resolve) => setTimeout(resolve, 0));
        if (signal?.aborted) throw signal.reason;
        const failure = options.script?.[setId]?.shift();
        if (failure) throw failure;
        onProgress?.({ loaded: 5, total: 10 });
        onProgress?.({ loaded: 10, total: 10 });
        return new Blob([`set ${setId}`]);
      } finally {
        inFlight--;
      }
    },
  };
  return { downloader, checks, checkSignals, downloads, peak: () => peak };
};

const memoryCache = (): OszCache => {
  const store = new Map<number, Blob>();
  return {
    get: async (setId) => {
      const blob = store.get(setId);
      return blob ? new File([blob], `${setId}n.osz`) : null;
    },
    put: async (setId, blob) => {
      store.set(setId, blob);
      return blob;
    },
    clear: async () => store.clear(),
  };
};

const recorder = () => {
  const waits: number[] = [];
  const updates: [number, SetStatus][] = [];
  return {
    waits,
    updates,
    sleep: async (ms: number) => {
      waits.push(ms);
    },
    onUpdate: (setId: number, status: SetStatus) => updates.push([setId, status]),
  };
};

const busy = () =>
  new HinaiError("upstream_relay_shed", "slow down", {
    status: 429,
    retryable: true,
    retryAfterMs: 5000,
  });
const down = () =>
  new HinaiError("http_error", "The beatmap mirror answered 503.", {
    status: 503,
    retryable: true,
  });

describe("fetchSets", () => {
  it("downloads each set once, caches it, and serves it from cache next time", async () => {
    const { downloader, downloads } = fakeDownloader();
    const cache = memoryCache();
    const rec = recorder();
    const first = await fetchSets([1, 2, 1], { downloader, cache, sleep: rec.sleep }, rec.onUpdate);
    expect([...first.keys()]).toEqual([1, 2]);
    expect(first.get(1)).toMatchObject({ status: "ready", fromCache: false });
    expect(downloads).toEqual([1, 2]);

    const second = await fetchSets([1, 2], { downloader, cache, sleep: rec.sleep }, rec.onUpdate);
    expect(second.get(1)).toMatchObject({ status: "ready", fromCache: true });
    expect(downloads).toEqual([1, 2]);
  });

  it("never runs more than 4 downloads at once", async () => {
    const { downloader, peak } = fakeDownloader();
    const rec = recorder();
    await fetchSets(
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(peak()).toBe(4);
  });

  it("waits out a busy mirror using its Retry-After, checking availability once", async () => {
    const { downloader, checks } = fakeDownloader({ script: { 1: [busy()] } });
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toMatchObject({ status: "ready" });
    expect(rec.waits).toEqual([5000]);
    expect(checks).toEqual([1]);
    expect(rec.updates).toContainEqual([1, { status: "waiting", retryInMs: 5000, attempt: 1 }]);
    expect(rec.updates).toContainEqual([
      1,
      { status: "downloading", loaded: 10, total: 10, attempt: 2 },
    ]);
  });

  it("gives up after 4 attempts with growing waits and says it can be retried", async () => {
    const { downloader, downloads } = fakeDownloader({
      script: { 1: [down(), down(), down(), down()] },
    });
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toEqual({
      status: "failed",
      message: "The beatmap mirror had a problem. Try again in a minute.",
      retryable: true,
    });
    expect(rec.waits).toEqual([1000, 2000, 4000]);
    expect(downloads).toHaveLength(4);
  });

  it("says the mirror had a problem when its answer couldn't be read", async () => {
    const unreadable = new HinaiError(
      "bad_response",
      "The mirror sent something that isn't a beatmap archive.",
      { status: 200 },
    );
    const { downloader } = fakeDownloader({ script: { 1: [unreadable] } });
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toEqual({
      status: "failed",
      message: "The beatmap mirror had a problem. Try again in a minute.",
      retryable: false,
    });
  });

  it("says a timeout and the mirror's own codes in plain words", async () => {
    const slow = () =>
      new HinaiError("timeout", "The beatmap mirror didn't answer in time (10000 ms). Try again.", {
        retryable: true,
      });
    const refused = new HinaiError("too_many_ids", "at most 100 ids (got 101)", { status: 400 });
    const { downloader } = fakeDownloader({
      script: {
        1: [slow(), slow(), slow(), slow()],
        2: [busy(), busy(), busy(), busy()],
        3: [refused],
      },
    });
    const rec = recorder();
    const results = await fetchSets(
      [1, 2, 3],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toEqual({
      status: "failed",
      message: "The beatmap mirror didn't answer in time. Try again.",
      retryable: true,
    });
    expect(results.get(2)).toEqual({
      status: "failed",
      message: "The beatmap mirror is busy. Try again in a minute.",
      retryable: true,
    });
    expect(results.get(3)).toEqual({
      status: "failed",
      message: "The beatmap mirror couldn't do that right now.",
      retryable: false,
    });
  });

  it("tells a download that broke off apart from a mirror it couldn't reach", async () => {
    const lost = () =>
      new HinaiError("network", "The download was interrupted. Try again.", { retryable: true });
    const downloader: FetchSetsDeps["downloader"] = {
      getAvailability: async () => ({ downloadable: true, reason: null }),
      downloadSet: async (setId, { onProgress } = {}) => {
        // Set 1 breaks off after some bytes arrived; set 2 never reaches the mirror.
        if (setId === 1) onProgress?.({ loaded: 5, total: 10 });
        throw lost();
      },
    };
    const rec = recorder();
    const results = await fetchSets(
      [1, 2],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toEqual({
      status: "failed",
      message: "The download was interrupted. Try again.",
      retryable: true,
    });
    expect(results.get(2)).toEqual({
      status: "failed",
      message: "Couldn't reach the beatmap mirror. Check your connection and try again.",
      retryable: true,
    });
  });

  it("hands the abort signal to the availability check", async () => {
    const { downloader, checkSignals } = fakeDownloader();
    const controller = new AbortController();
    const rec = recorder();
    await fetchSets(
      [1],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
      controller.signal,
    );
    expect(checkSignals).toEqual([controller.signal]);
  });

  it("fails fast when the mirror doesn't have the set", async () => {
    const missing = new HinaiError("not_found", "The mirror doesn't have this beatmapset.", {
      status: 404,
    });
    const { downloader, downloads } = fakeDownloader({ script: { 1: [missing] } });
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toEqual({
      status: "failed",
      message: "The mirror doesn't have this beatmapset.",
      retryable: false,
    });
    expect(downloads).toHaveLength(1);
    expect(rec.waits).toEqual([]);
  });

  it("doesn't download a set the mirror won't serve", async () => {
    const { downloader, downloads } = fakeDownloader({ disabled: { 1: "DMCA takedown" } });
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toEqual({
      status: "failed",
      message: "The mirror can't serve this set: DMCA takedown",
      retryable: false,
    });
    expect(downloads).toEqual([]);
  });

  it("fails an unexpected error with a generic message instead of crashing the pool", async () => {
    const { downloader } = fakeDownloader({ script: { 1: [new TypeError("boom")] } });
    const rec = recorder();
    const results = await fetchSets(
      [1, 2],
      { downloader, cache: memoryCache(), sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(results.get(1)).toEqual({
      status: "failed",
      message: "Something went wrong downloading this set. Try again.",
      retryable: false,
    });
    expect(results.get(2)).toMatchObject({ status: "ready" });
  });

  it("stops everything on abort", async () => {
    const { downloader, downloads } = fakeDownloader();
    const controller = new AbortController();
    const rec = recorder();
    const run = fetchSets(
      [1, 2, 3],
      { downloader, cache: memoryCache(), concurrency: 1, sleep: rec.sleep },
      (_setId, status) => {
        if (status.status === "downloading") controller.abort();
      },
      controller.signal,
    );
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(downloads).toEqual([1]);
  });
});

describe("fetchSets download options", () => {
  const NO_BACKGROUNDS = { videos: false, backgrounds: false };

  const optionsDownloader = (body: (setId: number) => BlobPart = (setId) => `set ${setId}`) => {
    const videos: (boolean | undefined)[] = [];
    const downloader: FetchSetsDeps["downloader"] = {
      getAvailability: async () => ({ downloadable: true, reason: null }),
      downloadSet: async (setId, { video } = {}) => {
        videos.push(video);
        return new Blob([body(setId)]);
      },
    };
    return { downloader, videos };
  };

  // Keyed by the real cache file name; put hands back a File, like OPFS does.
  const keyedCache = () => {
    const store = new Map<string, Blob>();
    const puts: string[] = [];
    const cache: OszCache = {
      get: async (setId, variant) => {
        const name = cacheFileName(setId, variant);
        const blob = store.get(name);
        return blob ? new File([blob], name) : null;
      },
      put: async (setId, blob, variant) => {
        const name = cacheFileName(setId, variant);
        store.set(name, blob);
        puts.push(name);
        return new File([blob], name);
      },
      clear: async () => store.clear(),
    };
    return { cache, puts };
  };

  const textOf = async (status: SetStatus | undefined) =>
    status?.status === "ready" ? status.blob.text() : null;

  it("asks for the video and caches it apart from the no-video download", async () => {
    const { downloader, videos } = optionsDownloader();
    const { cache, puts } = keyedCache();
    const rec = recorder();
    await fetchSets([1], { downloader, cache, sleep: rec.sleep }, rec.onUpdate, undefined, {
      videos: true,
      backgrounds: true,
    });
    await fetchSets([1], { downloader, cache, sleep: rec.sleep }, rec.onUpdate);
    expect(videos).toEqual([true, false]);
    expect(puts).toEqual(["1.osz", "1n.osz"]);
  });

  it("leaves backgrounds alone unless asked", async () => {
    const { downloader } = optionsDownloader();
    const strip = vi.fn(async (blob: Blob) => blob);
    const rec = recorder();
    await fetchSets(
      [1],
      { downloader, cache: keyedCache().cache, stripBackgrounds: strip, sleep: rec.sleep },
      rec.onUpdate,
    );
    expect(strip).not.toHaveBeenCalled();
  });

  it("removes backgrounds after the cache read and caches the result under its own name", async () => {
    const { downloader } = optionsDownloader();
    const { cache, puts } = keyedCache();
    const strip = vi.fn(async (_blob: Blob) => new Blob(["stripped"]));
    const rec = recorder();
    const deps = { downloader, cache, stripBackgrounds: strip, sleep: rec.sleep };

    const results = await fetchSets([1], deps, rec.onUpdate, undefined, NO_BACKGROUNDS);
    expect(results.get(1)).toMatchObject({ status: "ready", fromCache: false });
    // Handed on as the cached File, so big packs don't pile up in memory.
    const status = results.get(1);
    expect(status?.status === "ready" && status.blob instanceof File).toBe(true);
    expect(await textOf(status)).toBe("stripped");
    expect(puts).toEqual(["1n.osz", "1nb.osz"]);
    expect(await (await cache.get(1))?.text()).toBe("set 1");
    expect(rec.updates).toContainEqual([1, { status: "removing" }]);
  });

  it("names the rewritten copy of a with-video set {setId}b.osz", async () => {
    const { downloader } = optionsDownloader();
    const { cache, puts } = keyedCache();
    const rec = recorder();
    await fetchSets(
      [1],
      { downloader, cache, stripBackgrounds: async () => new Blob(["x"]), sleep: rec.sleep },
      rec.onUpdate,
      undefined,
      { videos: true, backgrounds: false },
    );
    expect(puts).toEqual(["1.osz", "1b.osz"]);
  });

  it("reads a set it already rewrote from the cache: no download, no rewrite", async () => {
    const { downloader, videos } = optionsDownloader();
    const { cache } = keyedCache();
    const strip = vi.fn(async (_blob: Blob) => new Blob(["stripped"]));
    const rec = recorder();
    const deps = { downloader, cache, stripBackgrounds: strip, sleep: rec.sleep };

    await fetchSets([1], deps, rec.onUpdate, undefined, NO_BACKGROUNDS);
    const second = await fetchSets([1], deps, rec.onUpdate, undefined, NO_BACKGROUNDS);
    expect(second.get(1)).toMatchObject({ status: "ready", fromCache: true });
    expect(await textOf(second.get(1))).toBe("stripped");
    expect(strip).toHaveBeenCalledOnce();
    expect(videos).toHaveLength(1);
  });

  it("caches nothing extra when a set has no background to remove", async () => {
    const { downloader } = optionsDownloader();
    const { cache, puts } = keyedCache();
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache, stripBackgrounds: async (blob) => blob, sleep: rec.sleep },
      rec.onUpdate,
      undefined,
      NO_BACKGROUNDS,
    );
    expect(await textOf(results.get(1))).toBe("set 1");
    expect(puts).toEqual(["1n.osz"]);
  });

  it("keeps the rewritten set in memory, and still works, without OPFS", async () => {
    const { downloader } = optionsDownloader();
    const strip = vi.fn(async (_blob: Blob) => new Blob(["stripped"]));
    const rec = recorder();
    const deps = {
      downloader,
      cache: createOszCache(async () => null),
      stripBackgrounds: strip,
      sleep: rec.sleep,
    };
    const first = await fetchSets([1], deps, rec.onUpdate, undefined, NO_BACKGROUNDS);
    expect(first.get(1)).toMatchObject({ status: "ready", fromCache: false });
    expect(await textOf(first.get(1))).toBe("stripped");
    const second = await fetchSets([1], deps, rec.onUpdate, undefined, NO_BACKGROUNDS);
    expect(await textOf(second.get(1))).toBe("stripped");
    expect(strip).toHaveBeenCalledTimes(2);
  });

  it("keeps a set as downloaded when its backgrounds can't be removed", async () => {
    const { downloader } = optionsDownloader();
    const { cache, puts } = keyedCache();
    const strip = async () => {
      throw new OszRewriteError("A file name in this set isn't UTF-8.");
    };
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache, stripBackgrounds: strip, sleep: rec.sleep },
      rec.onUpdate,
      undefined,
      NO_BACKGROUNDS,
    );
    expect(results.get(1)).toMatchObject({
      status: "ready",
      fromCache: false,
      backgroundsKept: true,
    });
    expect(await textOf(results.get(1))).toBe("set 1");
    expect(puts).toEqual(["1n.osz"]);
  });

  it("doesn't try to remove backgrounds from a set that failed", async () => {
    const downloader: FetchSetsDeps["downloader"] = {
      getAvailability: async () => ({ downloadable: false, reason: "DMCA takedown" }),
      downloadSet: async () => new Blob(["never"]),
    };
    const strip = vi.fn(async (blob: Blob) => blob);
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: keyedCache().cache, stripBackgrounds: strip, sleep: rec.sleep },
      rec.onUpdate,
      undefined,
      NO_BACKGROUNDS,
    );
    expect(results.get(1)?.status).toBe("failed");
    expect(strip).not.toHaveBeenCalled();
  });

  it("stops on abort while removing backgrounds", async () => {
    const { downloader } = optionsDownloader();
    const controller = new AbortController();
    // The abort happens in onUpdate, before this runs, so check first, then listen.
    const strip = (_blob: Blob, signal?: AbortSignal) =>
      new Promise<Blob>((_resolve, reject) => {
        if (signal?.aborted) reject(signal.reason);
        signal?.addEventListener("abort", () => reject(signal.reason));
      });
    const rec = recorder();
    const run = fetchSets(
      [1],
      { downloader, cache: keyedCache().cache, stripBackgrounds: strip, sleep: rec.sleep },
      (_setId, status) => {
        if (status.status === "removing") controller.abort();
      },
      controller.signal,
      NO_BACKGROUNDS,
    );
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
  });

  it("uses the in-browser remover by default", async () => {
    const osz = makeOsz([
      ["a.osu", osuFile(['0,0,"bg.jpg",0,0'])],
      ["bg.jpg", noise(10)],
    ]);
    const { downloader } = optionsDownloader(() => osz);
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: keyedCache().cache, sleep: rec.sleep },
      rec.onUpdate,
      undefined,
      NO_BACKGROUNDS,
    );
    const status = results.get(1);
    if (status?.status !== "ready") throw new Error(`expected ready, got ${status?.status}`);
    const files = unzipSync(new Uint8Array(await status.blob.arrayBuffer()));
    expect(Object.keys(files)).toEqual(["a.osu"]);
  });

  it("keeps a zip64 set as downloaded, byte for byte, with the in-browser remover", async () => {
    const osz = makeStreamedOsz(
      [
        ["a.osu", osuFile(['0,0,"bg.jpg",0,0'])],
        ["bg.jpg", noise(10)],
      ],
      { signature: true, zip64: true },
    );
    const { downloader } = optionsDownloader(() => osz);
    const rec = recorder();
    const results = await fetchSets(
      [1],
      { downloader, cache: keyedCache().cache, sleep: rec.sleep },
      rec.onUpdate,
      undefined,
      NO_BACKGROUNDS,
    );
    const status = results.get(1);
    expect(status).toMatchObject({ status: "ready", backgroundsKept: true });
    if (status?.status !== "ready") throw new Error(`expected ready, got ${status?.status}`);
    expect(new Uint8Array(await status.blob.arrayBuffer())).toEqual(osz);
  });
});

describe("fetchSets through the mirror client", () => {
  const run = (setIds: number[]) => {
    const rec = recorder();
    const deps = { downloader: mirror, cache: memoryCache(), sleep: rec.sleep };
    return { rec, results: fetchSets(setIds, deps, rec.onUpdate) };
  };

  it("uses the app's mirror client by default", () => {
    expect(DEFAULT_FETCH_DEPS.downloader).toBe(mirror);
  });

  it("downloads the no-video archive and reports progress against its length", async () => {
    let requested = "";
    server.use(
      http.get(HINAI_DOWNLOAD_URL, ({ request }) => {
        requested = request.url;
        const bytes = fakeOsz(39804);
        return new HttpResponse(bytes, { headers: { "content-length": String(bytes.byteLength) } });
      }),
    );
    const { rec, results } = run([39804]);
    const status = (await results).get(39804);
    if (status?.status !== "ready") throw new Error(`expected ready, got ${status?.status}`);
    expect(new Uint8Array(await status.blob.arrayBuffer())).toEqual(fakeOsz(39804));
    expect(new URL(requested).searchParams.get("noVideo")).toBe("true");
    expect(rec.updates).toContainEqual([
      39804,
      { status: "downloading", loaded: status.blob.size, total: status.blob.size, attempt: 1 },
    ]);
  });

  it("waits out a 429 for its Retry-After, then downloads, checking availability once", async () => {
    let checks = 0;
    server.use(
      http.get(HINAI_AVAILABILITY_URL, ({ params }) => {
        checks++;
        return HttpResponse.json({
          id: Number(params.setId),
          availability: { download_disabled: false, more_information: null },
        });
      }),
      http.get(
        HINAI_DOWNLOAD_URL,
        () =>
          HttpResponse.json(
            { code: "upstream_relay_shed", error: "slow down", retryable: true },
            { status: 429, headers: { "retry-after": "5" } },
          ),
        { once: true },
      ),
    );
    const { rec, results } = run([1]);
    expect((await results).get(1)).toMatchObject({ status: "ready", fromCache: false });
    expect(rec.waits).toEqual([5000]);
    expect(checks).toBe(1);
  });

  it("gives up on a mirror that keeps answering 503 and says it had a problem", async () => {
    let downloads = 0;
    server.use(
      http.get(HINAI_DOWNLOAD_URL, () => {
        downloads++;
        return new HttpResponse(null, { status: 503 });
      }),
    );
    const { rec, results } = run([1]);
    expect((await results).get(1)).toEqual({
      status: "failed",
      message: "The beatmap mirror had a problem. Try again in a minute.",
      retryable: true,
    });
    expect(rec.waits).toEqual([1000, 2000, 4000]);
    expect(downloads).toBe(4);
  });

  it("doesn't download a set the mirror won't serve", async () => {
    let downloads = 0;
    server.use(
      http.get(HINAI_AVAILABILITY_URL, () =>
        HttpResponse.json({
          id: 1,
          availability: { download_disabled: true, more_information: "DMCA takedown" },
        }),
      ),
      http.get(HINAI_DOWNLOAD_URL, () => {
        downloads++;
        return new HttpResponse(fakeOsz(1));
      }),
    );
    const { results } = run([1]);
    expect((await results).get(1)).toEqual({
      status: "failed",
      message: "The mirror can't serve this set: DMCA takedown",
      retryable: false,
    });
    expect(downloads).toBe(0);
  });

  it("fails fast on a set the mirror doesn't know (the recorded 404)", async () => {
    server.use(hinaiUnknownSetHandler);
    const { rec, results } = run([999999999]);
    expect((await results).get(999999999)).toEqual({
      status: "failed",
      message: "This beatmapset isn't on the mirror.",
      retryable: false,
    });
    expect(rec.waits).toEqual([]);
  });

  it("retries a 200 that isn't a zip, then says the mirror had a problem", async () => {
    let downloads = 0;
    server.use(
      http.get(HINAI_DOWNLOAD_URL, () => {
        downloads++;
        return new HttpResponse("<html>oops</html>", { headers: { "content-type": "text/html" } });
      }),
    );
    const { rec, results } = run([1]);
    expect((await results).get(1)).toEqual({
      status: "failed",
      message: "The beatmap mirror had a problem. Try again in a minute.",
      retryable: true,
    });
    expect(rec.waits).toEqual([1000, 2000, 4000]);
    expect(downloads).toBe(4);
  });

  it("stops on abort mid-download without calling it a failure", async () => {
    // The first bytes arrive, then the body stays open until the abort cuts it.
    server.use(
      http.get(
        HINAI_DOWNLOAD_URL,
        () =>
          new HttpResponse(
            new ReadableStream({
              start: (stream) => stream.enqueue(fakeOsz(1)),
            }),
          ),
      ),
    );
    const controller = new AbortController();
    const updates: SetStatus[] = [];
    const run = fetchSets(
      [1],
      { downloader: mirror, cache: memoryCache(), sleep: async () => undefined },
      (_setId, status) => {
        updates.push(status);
        if (status.status === "downloading" && status.loaded > 0) controller.abort();
      },
      controller.signal,
    );
    await expect(run).rejects.toMatchObject({ name: "AbortError" });
    expect(updates.some((status) => status.status === "downloading" && status.loaded > 0)).toBe(
      true,
    );
    expect(updates.some((status) => status.status === "failed")).toBe(false);
  });
});

describe("abortableSleep", () => {
  it("resolves after the delay", async () => {
    await expect(abortableSleep(1)).resolves.toBeUndefined();
  });

  it("rejects at once when already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(abortableSleep(10_000, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("rejects when aborted while waiting", async () => {
    const controller = new AbortController();
    const wait = abortableSleep(10_000, controller.signal);
    controller.abort();
    await expect(wait).rejects.toMatchObject({ name: "AbortError" });
  });
});
