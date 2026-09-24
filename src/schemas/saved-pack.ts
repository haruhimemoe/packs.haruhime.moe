/**
 * @file src/schemas/saved-pack.ts
 * @desc Saved packs (accounts): visibility, slug, the body POST/PUT accept, and the DTOs the API
 *       and pages pass around. Identity only; beatmap metadata is always fetched fresh. The only
 *       derived field is `stats` (filters), which the server computes and bodies never carry.
 *       Archive packs also carry `archive` (the tournament pool they were imported from), which
 *       only the importer writes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { z } from "zod";
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, SLUG_LENGTH } from "@/constants/pack";
import { packArchiveSchema } from "@/schemas/archive";
import { checkPoolBuckets, poolFields } from "@/schemas/pack";
import { packExportsSchema } from "@/schemas/pack-export";
import { packStatsSchema } from "@/schemas/pack-stats";
import { hasBlockedLanguage } from "@/utils/content-filter";
import { normalizeDescription } from "@/utils/text";

export const VISIBILITIES = ["private", "unlisted", "public"] as const;
export const visibilitySchema = z.enum(VISIBILITIES);
export type Visibility = z.infer<typeof visibilitySchema>;
export const DEFAULT_VISIBILITY: Visibility = "unlisted";

/** nanoid's URL-safe alphabet, exact length. */
export const slugSchema = z.string().regex(new RegExp(`^[A-Za-z0-9_-]{${SLUG_LENGTH}}$`));

/** Saved-pack description: line endings normalized, trimmed; "" means none. */
export const descriptionSchema = z
  .string()
  .transform(normalizeDescription)
  .pipe(
    z
      .string()
      .max(
        MAX_DESCRIPTION_LENGTH,
        `Keep the description to ${MAX_DESCRIPTION_LENGTH} characters or fewer.`,
      ),
  );

/** Body of POST /api/packs and PUT /api/packs/{slug}. Unknown keys (ownerId, slug) are dropped. */
/** Text over its limit already fails; skipping the blocklist keeps huge bodies cheap. */
const isClean =
  (max: number) =>
  (text: string): boolean =>
    text.length > max || !hasBlockedLanguage(text);
const cleanMessage = (field: string) => `Please keep the ${field} free of slurs.`;

export const packInputSchema = poolFields
  .extend({
    // Saved packs can be listed publicly, so their text goes through the blocklist.
    name: poolFields.shape.name.refine(isClean(MAX_NAME_LENGTH), cleanMessage("name")),
    visibility: visibilitySchema.default(DEFAULT_VISIBILITY),
    description: descriptionSchema
      .refine(isClean(MAX_DESCRIPTION_LENGTH), cleanMessage("description"))
      .optional(),
  })
  .superRefine(checkPoolBuckets)
  // Slot codes show wherever the pack's slots do, and map usage shows an archive pack's slot
  // labels on other people's packs: they go through the blocklist like the name.
  .superRefine((pack, ctx) => {
    for (const [i, bucket] of (pack.buckets ?? []).entries()) {
      if (hasBlockedLanguage(bucket.code)) {
        ctx.addIssue({
          code: "custom",
          path: ["buckets", i, "code"],
          message: cleanMessage("slot names"),
        });
      }
    }
  })
  .refine((pack) => pack.slots.length > 0, {
    message: "Add at least one map before saving.",
    path: ["slots"],
  });

export type PackInput = z.output<typeof packInputSchema>;
export type PackInputBody = z.input<typeof packInputSchema>;

export const savedPackSchema = poolFields
  .extend({
    slug: slugSchema,
    visibility: visibilitySchema,
    description: z.string().optional(),
    /** Magnet links the owner recorded, newest first. The service always sends it. */
    exports: packExportsSchema.optional(),
    /** Set when a moderator hid the pack; only its owner and admins ever receive it. */
    hiddenAt: z.string().optional(),
    /** Filter stats, once the server has computed them (a few seconds after a save). */
    stats: packStatsSchema.optional(),
    /** Archive packs only: the tournament pool the importer made this pack from. */
    archive: packArchiveSchema.optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  // A corrupt stored document must fail here (the page 404s/500s cleanly), not later inside
  // encodePackKey while rendering.
  .superRefine(checkPoolBuckets);

export type SavedPack = z.infer<typeof savedPackSchema>;

export const savedPackSummarySchema = z.object({
  slug: slugSchema,
  name: z.string(),
  slotCount: z.number().int().nonnegative(),
  visibility: visibilitySchema,
  hidden: z.boolean().optional(),
  updatedAt: z.string(),
});

export type SavedPackSummary = z.infer<typeof savedPackSummarySchema>;
