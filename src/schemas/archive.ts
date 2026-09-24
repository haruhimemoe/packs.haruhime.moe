/**
 * @file src/schemas/archive.ts
 * @desc Archive packs (pool archive spec): the `archive` details a pack imported from a tournament
 *       pool source carries (tournament, round, year, badged, fingerprint, sources), as the site
 *       and the API send them. Read-only: only the importer writes them, and pack bodies never
 *       carry them. Also a card's link to its first source.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import { ARCHIVE_SOURCE_KINDS } from "@/constants/archive";

/** Source links end up in hrefs: https only. */
const httpsUrl = z.url({ protocol: /^https$/ });

export const archiveSourceKindSchema = z.enum(ARCHIVE_SOURCE_KINDS);

export const archiveSourceSchema = z.object({
  kind: archiveSourceKindSchema.meta({
    description: "Where the pool came from: otdb, otr (o!TR) or wybin.",
  }),
  id: z.string().min(1).meta({ description: "The pool's id at that source." }),
  url: httpsUrl.meta({ description: "The pool's page at that source." }),
  importedAt: z.string().meta({ description: "When we first imported it from there (ISO 8601)." }),
});

export type ArchiveSource = z.infer<typeof archiveSourceSchema>;

/** sha256, lowercase hex. */
export const fingerprintSchema = z.string().regex(/^[0-9a-f]{64}$/);

export const packArchiveSchema = z
  .object({
    tournament: z.string().min(1).meta({
      description: 'The tournament, from the source\'s pool name ("osu! World Cup 2023").',
    }),
    round: z.string().nullable().meta({
      description: 'The round ("Finals", "Round of 16"). Null when the name has none we know.',
    }),
    year: z.number().int().nullable().meta({ description: "The year in the name, if any." }),
    badged: z.boolean().nullable().meta({
      description: "Whether the tournament was badged. Null until a source says.",
    }),
    fingerprint: fingerprintSchema.meta({
      description:
        'The pool\'s identity: sha256 of its sorted "beatmapId:mods" entries. The same pool from another source has the same one.',
    }),
    sources: z.array(archiveSourceSchema).min(1).meta({
      description: "Every source this pool was imported from, first import first.",
    }),
  })
  .meta({
    description:
      "Archive packs only: the tournament pool this pack was imported from. Read-only; bodies can't set it.",
  });

export type PackArchive = z.infer<typeof packArchiveSchema>;

/** A public card's link to the pool at its first source. */
export const archiveSourceLinkSchema = z.object({ kind: archiveSourceKindSchema, url: httpsUrl });

export type ArchiveSourceLink = z.infer<typeof archiveSourceLinkSchema>;
