/**
 * @file src/lib/beatmaps/lookup.ts
 * @desc Browser beatmap lookup: the hinai mirror (@haruhimemoe/hinai) first, then our /api/osu/beatmaps fallback for
 *       ids the mirror doesn't know. The fallback is best-effort: if it fails those ids simply
 *       stay "missing". Ids osu! couldn't check yet (its budget spent, or our route's per-IP
 *       limit hit) come back "unchecked", never missing, so the page can ask again.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapLookup } from "@haruhimemoe/hinai";
import { type BeatmapMeta, beatmapMetaSchema } from "@haruhimemoe/osu/shapes";
import { z } from "zod";
import { mirror } from "@/lib/mirror";

/** found, missing, and (from the osu! fallback) ids osu! couldn't check yet. */
export type SourceLookup = BeatmapLookup & { unchecked?: number[] };
/** Where metadata comes from. An abort rejects with the signal's reason. */
export type BeatmapSource = {
  getBeatmaps(ids: readonly number[], options?: { signal?: AbortSignal }): Promise<SourceLookup>;
};
/** What the fallback route answered: metadata, and ids osu! couldn't check yet. */
export type FallbackAnswer = { beatmaps: BeatmapMeta[]; unchecked: number[] };
type Fallback = (ids: readonly number[]) => Promise<FallbackAnswer>;

const fallbackResponseSchema = z.object({
  beatmaps: z.array(beatmapMetaSchema),
  // Older answers (and CDN copies of them) have no unchecked field.
  unchecked: z.array(z.number().int().positive()).default([]),
});
const NOTHING = (): FallbackAnswer => ({ beatmaps: [], unchecked: [] });

/**
 * @function fetchOsuFallback
 * @param ids {readonly number[]} ids the mirror didn't know
 * @param options {{ baseUrl?: string; fetch?: (input: string) => Promise<Response> }} tests
 * @returns {Promise<FallbackAnswer>} whatever osu! knew and the ids it couldn't check yet; every
 *          id unchecked when the route is rate limited (429); both empty on any other failure
 */
export const fetchOsuFallback = async (
  ids: readonly number[],
  {
    // Absolute in the browser; Node's fetch (tests) rejects a bare path.
    baseUrl = globalThis.location?.origin ?? "",
    fetch: doFetch = (input: string) => globalThis.fetch(input),
  }: { baseUrl?: string; fetch?: (input: string) => Promise<Response> } = {},
): Promise<FallbackAnswer> => {
  if (ids.length === 0) return NOTHING();
  try {
    const sorted = [...ids].sort((a, b) => a - b).join(",");
    const response = await doFetch(`${baseUrl}/api/osu/beatmaps?ids=${sorted}`);
    if (response.status === 429) return { beatmaps: [], unchecked: [...ids] };
    if (!response.ok) return NOTHING();
    const parsed = fallbackResponseSchema.safeParse(await response.json());
    return parsed.success ? parsed.data : NOTHING();
  } catch {
    return NOTHING();
  }
};

/**
 * @function withFallback
 * @param primary {BeatmapSource} the mirror (the abort signal goes to it)
 * @param fallback {Fallback} asked only for ids the primary reported missing
 * @returns {BeatmapSource} combined source; ids the fallback couldn't check yet are unchecked,
 *          not missing
 */
export const withFallback = (primary: BeatmapSource, fallback: Fallback): BeatmapSource => ({
  async getBeatmaps(ids, options) {
    const result = await primary.getBeatmaps(ids, options);
    if (result.missing.length === 0) return { ...result, unchecked: result.unchecked ?? [] };
    const wanted = new Set(result.missing);
    const found = new Map(result.found);
    const answer = await fallback(result.missing);
    for (const meta of answer.beatmaps) {
      if (wanted.has(meta.beatmapId)) found.set(meta.beatmapId, meta);
    }
    const later = new Set(answer.unchecked.filter((id) => wanted.has(id) && !found.has(id)));
    return {
      found,
      missing: result.missing.filter((id) => !found.has(id) && !later.has(id)),
      unchecked: [...(result.unchecked ?? []), ...later],
    };
  },
});

/** The app's default lookup. */
export const beatmapLookup: BeatmapSource = withFallback(mirror, (ids) => fetchOsuFallback(ids));
