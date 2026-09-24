/**
 * @file src/schemas/star-ratings.ts
 * @desc GET /api/osu/star-ratings: the q list of "{beatmapId}:{mods}" pairs (canonical mod sets
 *       only, so one pool always makes one URL; an overlong q is refused before it's split) and
 *       the { ratings, pending } answer.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Wed Sep 23, 2026
 */

import { type ModAcronym, modSetProblem } from "@haruhimemoe/pool";
import { z } from "zod";
import { MAX_STAR_PAIRS, MAX_STAR_QUERY_LENGTH, type StarPair } from "@/constants/star-ratings";
import { beatmapIdSchema } from "@/schemas/pack";

const PAIR_PATTERN = /^([1-9]\d{0,9}):((?:[A-Z]{2}){1,3})$/;

export const starPairSchema = z.string().transform((value, ctx): StarPair => {
  const match = PAIR_PATTERN.exec(value);
  const beatmapId = Number(match?.[1]);
  const set = match?.[2]?.match(/[A-Z]{2}/g) ?? [];
  if (!match || !beatmapIdSchema.safeParse(beatmapId).success || modSetProblem(set) !== null) {
    ctx.addIssue({ code: "custom", message: `${value} isn't a beatmapId:mods pair.` });
    return z.NEVER;
  }
  return { key: value, beatmapId, set: set as ModAcronym[] };
});

export const starPairsQuerySchema = z
  .string()
  .max(MAX_STAR_QUERY_LENGTH)
  .transform((q) => q.split(","))
  .pipe(z.array(starPairSchema).min(1).max(MAX_STAR_PAIRS))
  .transform((pairs) => [...new Map(pairs.map((pair) => [pair.key, pair])).values()]);

export const starRatingsResponseSchema = z.object({
  ratings: z.record(z.string(), z.number().nonnegative()),
  pending: z.array(z.string()),
});

export type StarRatingsResponse = z.infer<typeof starRatingsResponseSchema>;
