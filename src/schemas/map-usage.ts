/**
 * @file src/schemas/map-usage.ts
 * @desc Map usage: the archive pools a beatmap was used in, as the
 *       public API answers and the site reads it, and the `{id}` and `?ids=` the usage routes take.
 *       One entry per slot the map filled, carrying its pool's fingerprint; `count` is how many
 *       pools.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import { MAX_USAGE_IDS } from "@/constants/map-usage";
import { fingerprintSchema } from "@/schemas/archive";
import { beatmapIdSchema } from "@/schemas/pack";
import { slugSchema } from "@/schemas/saved-pack";

export const mapUsageEntrySchema = z.object({
  slug: slugSchema.meta({
    description: "The archive pack's slug. Its page is https://packs.haruhime.moe/p/{slug}.",
  }),
  tournament: z.string().min(1).meta({
    description: 'The tournament, from the pool\'s name ("osu! World Cup 2023").',
  }),
  round: z.string().nullable().meta({
    description: 'The round ("Grand Finals"). Null when the name has none we know.',
  }),
  year: z.number().int().nullable().meta({ description: "The year in the name, if any." }),
  badged: z.boolean().nullable().meta({
    description: "Whether the tournament was badged. Null until a source says.",
  }),
  slot: z.string().min(1).meta({
    description:
      'The slot the map filled in that pool ("NM1", "HDHR2", "TB1"; just the number for a map without a slot).',
  }),
  mods: z.string().min(1).meta({
    description:
      'What that slot plays with: NM, HD, HR, DT, FM or TB for a built-in slot, the forced mods of a custom slot ("HDHR"), FM for a custom free mod slot, NM for a custom slot without mods and for a map without a slot.',
  }),
  fingerprint: fingerprintSchema.meta({
    description:
      "That pool's fingerprint, the same as its pack's archive.fingerprint: a pool with the same maps and mods has the same one, so a client can leave out the pool it's showing.",
  }),
});

export type MapUsageEntry = z.infer<typeof mapUsageEntrySchema>;

export const beatmapUsageSchema = z.object({
  beatmapId: beatmapIdSchema.meta({ description: "The beatmap (difficulty) id." }),
  count: z.number().int().nonnegative().meta({
    description:
      "How many archive pools used the map. A pool with the map in two slots has two entries and counts once.",
  }),
  entries: z.array(mapUsageEntrySchema).meta({
    description:
      "One per slot the map filled, most recent year first, then pools without a year. Empty when no archive pool used it.",
  }),
});

export type BeatmapUsage = z.infer<typeof beatmapUsageSchema>;

/** GET /api/v1/beatmaps/usage */
export const beatmapUsageListSchema = z.object({
  beatmaps: z.array(beatmapUsageSchema).meta({
    description: "One per id asked for, in the order asked, each id once.",
  }),
});

export type BeatmapUsageList = z.infer<typeof beatmapUsageListSchema>;

/** A beatmap id as a path segment or list item: digits only, then a valid id. */
export const beatmapIdTextSchema = z
  .string()
  .regex(/^\d{1,10}$/)
  .transform(Number)
  .pipe(beatmapIdSchema);

/** The longest valid id (2147483647, 10 digits) plus a comma, for every id allowed. */
const MAX_IDS_TEXT = MAX_USAGE_IDS * 11;

/** `?ids=1,2,3`: 1 to MAX_USAGE_IDS ids as sent, then each id once in the order first sent. */
export const usageIdsQuerySchema = z
  .string()
  .max(MAX_IDS_TEXT)
  .transform((text) => text.split(",").filter((part) => part !== ""))
  .pipe(z.array(beatmapIdTextSchema).min(1).max(MAX_USAGE_IDS))
  .transform((ids) => [...new Set(ids)]);
