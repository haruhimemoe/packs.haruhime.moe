/**
 * @file src/lib/torrent/pack-torrent.ts
 * @desc A pack's torrent: the zip's exact files (plan folder, numbered .osz files, pack.txt last),
 *       so an unzipped pack seeds it as-is. Browser-only.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { SITE } from "@/constants/site";
import { TRACKERS } from "@/constants/trackers";
import {
  type BuildOptions,
  type BuiltTorrent,
  buildTorrent,
  type TorrentInput,
} from "@/lib/torrent/build-torrent";
import { downloadBlob } from "@/lib/zip/save-zip";
import type { ArchivePlan } from "@/utils/pack-archive";

export type PackTorrentInput = {
  plan: ArchivePlan;
  blobs: ReadonlyMap<number, Blob>;
  packKey: string;
};

/**
 * @function packTorrentInput
 * @param input {PackTorrentInput} archive plan, downloaded blob per set, pack key
 * @returns {TorrentInput} files in plan order, then pack.txt
 * @throws {Error} when a planned set has no blob
 */
export const packTorrentInput = ({ plan, blobs, packKey }: PackTorrentInput): TorrentInput => ({
  name: plan.folder,
  files: [
    ...plan.files.map((file) => {
      const data = blobs.get(file.setId);
      if (!data) throw new Error(`No download for beatmapset ${file.setId}`);
      return { path: file.path, data };
    }),
    // Blob encodes strings as UTF-8, the same bytes the zip writes.
    { path: "pack.txt", data: new Blob([plan.packTxt]) },
  ],
  trackers: TRACKERS,
  comment: `Made with ${SITE.title}. Pack key: ${packKey}`,
  createdBy: SITE.title,
});

/**
 * @function makePackTorrent
 * @param input {PackTorrentInput} same input as packTorrentInput
 * @param options {BuildOptions} progress, abort signal
 * @returns {Promise<BuiltTorrent>}
 */
export const makePackTorrent = (
  input: PackTorrentInput,
  options?: BuildOptions,
): Promise<BuiltTorrent> => buildTorrent(packTorrentInput(input), options);

/**
 * @function saveTorrentFile
 * @param built {BuiltTorrent} a made torrent
 * @param plan {ArchivePlan} its plan (names the file)
 * @param download {(blob: Blob, filename: string) => void} download trigger (tests)
 */
export const saveTorrentFile = (
  built: BuiltTorrent,
  plan: ArchivePlan,
  download: (blob: Blob, filename: string) => void = downloadBlob,
): void => {
  download(
    new Blob([built.torrent], { type: "application/x-bittorrent" }),
    `${plan.folder}.torrent`,
  );
};
