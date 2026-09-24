/**
 * @file src/lib/zip/pack-zip.ts
 * @desc Streams a pack zip with client-zip (STORE; .osz files are already compressed): the planned
 *       .osz files plus pack.txt, all in one folder. Built entirely in the browser.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { makeZip, predictLength } from "client-zip";
import type { ArchivePlan } from "@/utils/pack-archive";

/** Above this, building the zip in memory (no save dialog) gets a warning. */
export const BLOB_FALLBACK_WARN_BYTES = 1_000_000_000;

export type PackZipInput = {
  plan: ArchivePlan;
  blobs: ReadonlyMap<number, Blob>;
  lastModified?: Date;
};

const utf8 = new TextEncoder();

const entries = ({ plan, blobs, lastModified = new Date() }: PackZipInput) => [
  ...plan.files.map((file) => {
    const input = blobs.get(file.setId);
    if (!input) throw new Error(`No download for beatmapset ${file.setId}`);
    return { name: `${plan.folder}/${file.path}`, input, lastModified };
  }),
  { name: `${plan.folder}/pack.txt`, input: utf8.encode(plan.packTxt), lastModified },
];

/**
 * @function packZipStream
 * @param input {PackZipInput} archive plan and the downloaded blob for each planned set
 * @returns {ReadableStream<Uint8Array>} the zip bytes
 * @throws {Error} synchronously when a planned set has no blob
 */
export const packZipStream = (input: PackZipInput): ReadableStream<Uint8Array> =>
  makeZip(entries(input));

/**
 * @function packZipSize
 * @param input {PackZipInput} same input as packZipStream
 * @returns {number} exact zip size in bytes
 */
export const packZipSize = (input: PackZipInput): number =>
  Number(
    predictLength(
      entries(input).map(({ name, input: data }) => ({
        name,
        size: data instanceof Blob ? data.size : data.byteLength,
      })),
    ),
  );
