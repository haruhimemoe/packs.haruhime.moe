/**
 * @file src/schemas/otdb.ts
 * @desc otdb's mappool export (https://otdb.sheppsu.me/static/mappools-export.json), only the
 *       fields the archive importer uses: each pool's id and name, and per map its slot label,
 *       osu! beatmap id, length, BPM, star rating and mods. Everything else (submitted_by,
 *       favorite_count, set and artist details) is dropped on parse and never stored.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";

/** One map in a pool. `beatmap.id` is otdb's own id; the osu! id is `beatmap_metadata.id`. */
export const otdbConnectionSchema = z.object({
  slot: z.string(),
  beatmap: z.object({
    /** With the connection's mods applied: EZ, HR, DT and HT change it. */
    star_rating: z.number().nonnegative(),
    mods: z.array(z.object({ acronym: z.string() })),
    beatmap_metadata: z.object({
      id: z.number().int().positive(),
      /** Seconds, without mods. */
      length: z.number().nonnegative(),
      /** Without mods. */
      bpm: z.number().nonnegative(),
    }),
  }),
});

export type OtdbConnection = z.infer<typeof otdbConnectionSchema>;

export const otdbPoolSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  beatmap_connections: z.array(otdbConnectionSchema),
});

export type OtdbPool = z.infer<typeof otdbPoolSchema>;
