/**
 * @file src/schemas/pack-export.ts
 * @desc Export links recorded on saved packs. Only magnet links for now; `kind` stays an enum so
 *       Drive and OneDrive folders can join later.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { z } from "zod";
import { MAX_MAGNET_LENGTH, MAX_PACK_EXPORTS } from "@/constants/pack";
import { infohashOf } from "@/utils/magnet";

/** A v1 magnet link. Anything that fails here never reaches an href. */
export const magnetSchema = z
  .string()
  .max(MAX_MAGNET_LENGTH, "That magnet link is too long.")
  .refine((url) => infohashOf(url) !== null, "That isn't a torrent magnet link.");

export const EXPORT_KINDS = ["magnet"] as const;

/** Body of POST /api/packs/{slug}/exports. */
export const packExportInputSchema = z.strictObject({
  kind: z.literal("magnet"),
  url: magnetSchema,
  /** The pack key the torrent was made from; the server refuses it if the pack has changed. */
  packKey: z.string().min(1, "Missing the pack key.").max(4096),
});

export const packExportSchema = z.object({
  kind: z.enum(EXPORT_KINDS),
  url: magnetSchema,
  createdAt: z.string(),
});

export type PackExport = z.infer<typeof packExportSchema>;

export const packExportsSchema = z.array(packExportSchema).max(MAX_PACK_EXPORTS);
