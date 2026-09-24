/**
 * @file src/schemas/download-choices.ts
 * @desc The Download card's download options: include videos, include backgrounds.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { z } from "zod";

export const downloadChoicesSchema = z.object({
  videos: z.boolean(),
  backgrounds: z.boolean(),
});

export type DownloadChoices = z.infer<typeof downloadChoicesSchema>;

/** Videos make packs several times larger, so they're off unless asked for. */
export const DEFAULT_DOWNLOAD_CHOICES: DownloadChoices = { videos: false, backgrounds: true };
