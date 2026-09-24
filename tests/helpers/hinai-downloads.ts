/**
 * @file tests/helpers/hinai-downloads.ts
 * @desc MSW handlers for hinai availability and .osz downloads, as @haruhimemoe/hinai asks for
 *       them, plus the recorded 404 for an unknown set (the client reads a 404's body for the
 *       mirror's hint). Archives are synthetic zips built with fflate: real .osz files are
 *       copyrighted and never committed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { strToU8, zipSync } from "fflate";
import { HttpResponse, http } from "msw";
import available from "../fixtures/hinai/availability-39804.json";
import unknown from "../fixtures/hinai/availability-unknown.json";

export const HINAI_DOWNLOAD_URL = "https://mirror.hinamizawa.ai/api/v1/hinai/d/:setId";
export const HINAI_AVAILABILITY_URL = "https://mirror.hinamizawa.ai/api/s/:setId/availability";

/** A fixed zip timestamp: fflate stamps "now" otherwise, so two calls could differ in bytes. */
const FAKE_OSZ_MTIME = new Date("2026-09-22T00:00:00Z");

/**
 * @function fakeOsz
 * @param setId {number} beatmapset id written into the stand-in .osu file
 * @returns {Uint8Array<ArrayBuffer>} a small valid zip, the same bytes on every call
 */
export const fakeOsz = (setId: number): Uint8Array<ArrayBuffer> =>
  new Uint8Array(
    zipSync(
      { [`${setId}.osu`]: strToU8(`osu file format v14\n// set ${setId}\n`) },
      { mtime: FAKE_OSZ_MTIME },
    ),
  );

/** The mirror's recorded answer for a set no source knows: a 404 with its JSON error body. */
export const hinaiUnknownSetHandler = http.get(HINAI_AVAILABILITY_URL, () =>
  HttpResponse.json(unknown, { status: 404 }),
);

export const hinaiDownloadHandlers = [
  http.get(HINAI_AVAILABILITY_URL, ({ params }) =>
    HttpResponse.json({ ...available, id: Number(params.setId) }),
  ),
  http.get(HINAI_DOWNLOAD_URL, ({ params }) => {
    const bytes = fakeOsz(Number(params.setId));
    return new HttpResponse(bytes, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(bytes.byteLength),
      },
    });
  }),
];
