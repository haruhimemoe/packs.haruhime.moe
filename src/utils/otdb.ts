/**
 * @file src/utils/otdb.ts
 * @desc otdb's mappool export to source pools: each pool's id, name, link
 *       and slots (label, osu! beatmap id, and the mods otdb lists for it), plus the details the
 *       export has for each map, which
 *       seed pack stats: length and BPM (without mods), mode osu (otdb is osu!standard only), and
 *       the plain star rating from any entry of the map without rating mods (the export's rating
 *       has the entry's mods applied, so a map only ever listed with HR or DT has none). Entries
 *       that don't match the export's shape are skipped with a reason. Submitters and favorite
 *       counts are never read. Pure.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { OTDB_POOL_URL_PREFIX } from "@/constants/archive";
import { otdbPoolSchema } from "@/schemas/otdb";
import {
  type ArchiveSourceRef,
  ratingModsOf,
  type SkippedPool,
  type SourcePool,
} from "@/utils/archive-pools";
import type { StatsMeta } from "@/utils/saved-pack-stats";

/**
 * @function otdbPoolUrl
 * @param id {number | string} an otdb pool id
 * @returns {string} that pool's page on otdb
 */
export const otdbPoolUrl = (id: number | string): string => `${OTDB_POOL_URL_PREFIX}${id}/`;

/**
 * @function otdbSource
 * @param id {number | string} an otdb pool id
 * @returns {ArchiveSourceRef} the pool as an archive source
 */
export const otdbSource = (id: number | string): ArchiveSourceRef => ({
  kind: "otdb",
  id: String(id),
  url: otdbPoolUrl(id),
});

export type OtdbRead = {
  pools: SourcePool[];
  /** Map details by osu! beatmap id, for the seeded stats. */
  meta: Map<number, StatsMeta>;
  skipped: SkippedPool[];
};

/** Whatever id and name an entry that doesn't parse still has, for the report. */
const describeBad = (item: unknown, position: number): { id: string; name: string } => {
  const record = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
  return {
    id: typeof record.id === "number" ? String(record.id) : `entry ${position + 1}`,
    name: typeof record.name === "string" ? record.name : "",
  };
};

/**
 * @function readOtdbExport
 * @param raw {unknown} the export as parsed JSON
 * @returns {OtdbRead} every pool that matches the export's shape as a source pool (same order),
 *          the map details they give, and the entries that don't match
 * @throws {Error} when the export isn't a list of pools at all
 */
export const readOtdbExport = (raw: unknown): OtdbRead => {
  if (!Array.isArray(raw)) throw new Error("The otdb export isn't a list of pools.");
  const pools: SourcePool[] = [];
  const meta = new Map<number, StatsMeta>();
  const skipped: SkippedPool[] = [];
  raw.forEach((item: unknown, position) => {
    const parsed = otdbPoolSchema.safeParse(item);
    if (!parsed.success) {
      skipped.push({
        kind: "otdb",
        ...describeBad(item, position),
        reason: "Doesn't match the otdb export's format.",
      });
      return;
    }
    const pool = parsed.data;
    for (const { beatmap } of pool.beatmap_connections) {
      const { id, length, bpm } = beatmap.beatmap_metadata;
      const known = meta.get(id);
      const plain = ratingModsOf(beatmap.mods.map(({ acronym }) => acronym)).length === 0;
      if (known && (known.starRating !== null || !plain)) continue;
      meta.set(id, {
        mode: "osu",
        lengthSeconds: known?.lengthSeconds ?? length,
        bpm: known?.bpm ?? bpm,
        starRating: plain ? beatmap.star_rating : null,
      });
    }
    pools.push({
      source: otdbSource(pool.id),
      name: pool.name,
      slots: pool.beatmap_connections.map(({ slot, beatmap }) => ({
        label: slot,
        beatmapId: beatmap.beatmap_metadata.id,
        mods: beatmap.mods.map(({ acronym }) => acronym),
      })),
    });
  });
  return { pools, meta, skipped };
};
