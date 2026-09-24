/**
 * @file src/utils/pack-archive.ts
 * @desc What goes in a pack's zip and torrent: one folder, numbered
 *       "{NN} {label} - {artist} - {title}.osz" files (no label for no-slot maps), and a pack.txt
 *       with the key, the download options and the listing. File names are made safe for Windows
 *       and macOS.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { type BeatmapMeta, beatmapUrl } from "@haruhimemoe/osu/shapes";
import { bucketsOf, slotLabel, sortSlots } from "@haruhimemoe/pool";
import { DEFAULT_PACK_NAME } from "@/constants/pack";
import { DEFAULT_DOWNLOAD_CHOICES, type DownloadChoices } from "@/schemas/download-choices";
import type { Pool, PoolSlot } from "@/schemas/pack";

// Windows "Extract All" nests the zip-name folder around our folder, so the folder name appears
// twice in the path: 28 (C:\Users\name\Downloads\) + 2 × 48 + 2 + 100 stays under MAX_PATH (260).
export const MAX_FILE_STEM = 96;
export const MAX_FOLDER_NAME = 48;

const ILLEGAL = '<>:"/\\|?*';
const RESERVED = /^(con|prn|aux|nul|conin\$|conout\$|com[1-9¹²³]|lpt[1-9¹²³])(\..*)?$/i;

const isIllegal = (char: string): boolean => {
  const code = char.charCodeAt(0);
  return ILLEGAL.includes(char) || code < 0x20 || code === 0x7f;
};

/**
 * @function sanitizeFileName
 * @param name {string} any text
 * @param maxLength {number} max characters (code points) to keep
 * @returns {string} a name that works on Windows and macOS; never empty
 */
export const sanitizeFileName = (name: string, maxLength: number = MAX_FILE_STEM): string => {
  const collapsed = name.replace(/\s+/g, " ");
  const cleaned = Array.from(collapsed, (char) => (isIllegal(char) ? "_" : char))
    .join("")
    .replace(/^[. ]+/, "");
  const clipped = Array.from(cleaned)
    .slice(0, maxLength)
    .join("")
    .replace(/[. ]+$/, "");
  const safe = clipped === "" ? "_" : clipped;
  return RESERVED.test(safe) ? `_${safe}` : safe;
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Zip and pack.txt label: the slot label, or nothing for no-slot maps (the position says it). */
const archiveLabel = (slot: PoolSlot): string => (slot.mod === null ? "" : slotLabel(slot));

/**
 * @function slotFileName
 * @param position {number} 1-based slot number in pool order
 * @param slot {PoolSlot} the slot
 * @param meta {BeatmapMeta} its beatmap
 * @returns {string} "01 NM1 - Artist - Title.osz", or "01 - Artist - Title.osz" for no slot
 */
export const slotFileName = (position: number, slot: PoolSlot, meta: BeatmapMeta): string => {
  const label = archiveLabel(slot);
  const stem = `${pad2(position)} ${label === "" ? "" : `${label} `}- ${meta.artist} - ${meta.title}`;
  return `${sanitizeFileName(stem)}.osz`;
};

export type ArchiveFile = { position: number; slot: PoolSlot; setId: number; path: string };
export type SkippedSlot = { position: number; slot: PoolSlot; reason: "missing" | "failed" };
export type ArchivePlan = {
  folder: string;
  zipName: string;
  files: ArchiveFile[];
  skipped: SkippedSlot[];
  packTxt: string;
};
export type ArchiveInput = {
  pack: Pool;
  packKey: string;
  siteUrl: string;
  getMeta: (beatmapId: number) => BeatmapMeta | null;
  failedSetIds?: ReadonlySet<number>;
  /** What the downloads include; written into pack.txt. */
  choices?: DownloadChoices;
  /** Sets whose backgrounds couldn't be removed (they're included as downloaded). */
  backgroundsKeptSetIds?: ReadonlySet<number>;
};

const optionsLine = ({ videos, backgrounds }: DownloadChoices): string =>
  `Videos: ${videos ? "included" : "not included"}. Backgrounds: ${backgrounds ? "included" : "removed"}.`;

/**
 * @function planArchive
 * @param input {ArchiveInput} pack, its key, the site origin, metadata lookup, failed set ids, download options
 * @returns {ArchivePlan} folder/zip names, files to include, skipped slots, and pack.txt
 */
export const planArchive = ({
  pack,
  packKey,
  siteUrl,
  getMeta,
  failedSetIds = new Set<number>(),
  choices = DEFAULT_DOWNLOAD_CHOICES,
  backgroundsKeptSetIds = new Set<number>(),
}: ArchiveInput): ArchivePlan => {
  const name = pack.name.trim() || DEFAULT_PACK_NAME;
  const folder = sanitizeFileName(name, MAX_FOLDER_NAME);
  const files: ArchiveFile[] = [];
  const skipped: SkippedSlot[] = [];
  const listing: string[] = [];

  const ordered = sortSlots(pack.slots, bucketsOf(pack));
  const width = Math.max(4, ...ordered.map((slot) => archiveLabel(slot).length));
  ordered.forEach((slot, i) => {
    const position = i + 1;
    const label = `${pad2(position)}  ${archiveLabel(slot).padEnd(width)} `;
    const meta = getMeta(slot.beatmapId);
    if (!meta) {
      skipped.push({ position, slot, reason: "missing" });
      listing.push(
        `${label}beatmap ${slot.beatmapId}`,
        "      not included: not found on the mirror",
      );
    } else {
      listing.push(
        `${label}${meta.artist} - ${meta.title} [${meta.version}] (mapped by ${meta.creator})`,
      );
      if (failedSetIds.has(meta.beatmapsetId)) {
        skipped.push({ position, slot, reason: "failed" });
        listing.push("      not included: the download failed");
      } else {
        files.push({
          position,
          slot,
          setId: meta.beatmapsetId,
          path: slotFileName(position, slot, meta),
        });
        if (backgroundsKeptSetIds.has(meta.beatmapsetId)) {
          listing.push("      background kept: couldn't remove it");
        }
      }
    }
    listing.push(`      ${beatmapUrl(slot.beatmapId)}`);
  });

  const count = pack.slots.length;
  const packTxt = [
    name,
    `${count} ${count === 1 ? "map" : "maps"}, made with packs.haruhime.moe`,
    "",
    `Pack key: ${packKey}`,
    `Open it: ${siteUrl}/k#${packKey}`,
    optionsLine(choices),
    "",
    ...listing,
    "",
    "Beatmaps were downloaded from mirror.hinamizawa.ai by whoever made this pack.",
    "Songs and artwork belong to their owners. You're responsible for having the rights to share them.",
    "",
  ].join("\n");

  return { folder, zipName: `${folder}.zip`, files, skipped, packTxt };
};
