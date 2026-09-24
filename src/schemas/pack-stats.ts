/**
 * @file src/schemas/pack-stats.ts
 * @desc Pack stats as the site and the API send them, and their compact form in
 *       the search index and on public cards. The server computes them from the pack's slots and
 *       beatmap metadata when it saves a pack; the browser never sends them. Also what one run of
 *       the stats job reports.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { rulesetSchema } from "@haruhimemoe/osu/shapes";
import { z } from "zod";
import { STAT_MOD_CODES } from "@/constants/pack-stats";

const stars = z.number().nonnegative().nullable();
const whole = z.number().int().nonnegative().nullable();

export const packStatsSchema = z
  .object({
    srMin: stars.meta({ description: "Lowest star rating, 2 decimals. Null when none is known." }),
    srMax: stars.meta({ description: "Highest star rating, 2 decimals." }),
    srAvg: stars.meta({ description: "Average star rating over the slots, 2 decimals." }),
    lenMin: whole.meta({ description: "Shortest map in seconds, after DT and HT." }),
    lenMax: whole.meta({ description: "Longest map in seconds, after DT and HT." }),
    bpmMin: whole.meta({ description: "Lowest BPM, after DT and HT." }),
    bpmMax: whole.meta({ description: "Highest BPM, after DT and HT." }),
    mods: z.array(z.enum(STAT_MOD_CODES)).meta({
      description:
        "Mods the pack has: its built-in slots (NM HD HR DT FM TB) and the mods its custom slots force (EZ HD HR DT HT FL; a custom freemod slot counts as FM), in that order.",
    }),
    modes: z.array(rulesetSchema).meta({ description: "Rulesets of the pack's maps." }),
    count: z.number().int().nonnegative().meta({ description: "Number of maps." }),
    complete: z.boolean().meta({
      description:
        "False when a map's details or a rating with mods couldn't be looked up; the numbers then cover the maps that could. A map osu! says doesn't exist is left out and doesn't count.",
    }),
    computedAt: z.string().meta({ description: "When the stats were computed (ISO 8601)." }),
  })
  .meta({
    description:
      "Star rating, length and BPM ranges, mods and rulesets, computed on the server after a save. Slots that force EZ, HR, DT, HT or FL count with their rating with mods.",
  });

export type PackStats = z.infer<typeof packStatsSchema>;

const range = z.tuple([z.number(), z.number()]);

/**
 * Stats in the search index and on public cards: r star range, a average stars, l length range
 * (seconds), b BPM range, m mods and g rulesets (comma-separated, in stats order), k complete.
 * Unknown ranges are left out; k is always there, so `k !== undefined` means "has stats".
 */
export const indexStatsSchema = z.object({
  r: range.optional(),
  a: z.number().optional(),
  l: range.optional(),
  b: range.optional(),
  m: z.string(),
  g: z.string(),
  k: z.boolean(),
});

export type IndexStats = z.infer<typeof indexStatsSchema>;

/**
 * One run of the stats job (the cron and the admin button): packs updated, packs the next run
 * would still take (no stats, or incomplete ones due for a retry), and packs whose incomplete
 * stats wait for a later retry.
 */
export const packStatsJobSchema = z.object({
  updated: z.number().int().nonnegative(),
  remaining: z.number().int().nonnegative(),
  waiting: z.number().int().nonnegative(),
});

export type PackStatsJob = z.infer<typeof packStatsJobSchema>;
