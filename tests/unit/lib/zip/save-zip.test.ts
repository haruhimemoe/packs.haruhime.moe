/**
 * @file tests/unit/lib/zip/save-zip.test.ts
 * @desc saveZip: stream to a picked file, cancel, refused picker, and the Blob fallback.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import { saveZip } from "@/lib/zip/save-zip";
import type { Pool } from "@/schemas/pack";
import { planArchive } from "@/utils/pack-archive";
import { fakeOsz } from "../../../helpers/hinai-downloads";

const PACK: Pool = { name: "SPC Quals", slots: [{ mod: "NM", index: 1, beatmapId: 1 }] };
const INPUT = {
  plan: planArchive({
    pack: PACK,
    packKey: "pk1.test",
    siteUrl: "https://packs.haruhime.moe",
    getMeta: () => ({
      beatmapId: 1,
      beatmapsetId: 10,
      mode: "osu" as const,
      title: "T",
      artist: "A",
      version: "V",
      creator: "C",
      creatorId: null,
      cs: 4,
      ar: 9,
      od: 8,
      hp: 6,
      bpm: 180,
      lengthSeconds: 120,
      starRating: 5,
      checksum: null,
    }),
  }),
  blobs: new Map([[10, new Blob([fakeOsz(10)])]]),
};

const entryNames = async (data: Blob | Uint8Array[]) =>
  Object.keys(
    unzipSync(
      new Uint8Array(
        await (data instanceof Blob
          ? data
          : new Blob(data.map((part) => new Uint8Array(part)))
        ).arrayBuffer(),
      ),
    ),
  );

const pickerWritingTo = (parts: Uint8Array[]) =>
  vi.fn(
    async () =>
      ({
        createWritable: async () =>
          new WritableStream<Uint8Array>({
            write: (chunk) => {
              parts.push(chunk);
            },
          }),
      }) as unknown as FileSystemFileHandle,
  );

describe("saveZip", () => {
  it("streams straight into the picked file", async () => {
    const parts: Uint8Array[] = [];
    const picker = pickerWritingTo(parts);
    const downloadBlob = vi.fn();
    await expect(saveZip(INPUT, { picker, downloadBlob })).resolves.toBe("streamed");
    expect(picker).toHaveBeenCalledWith(
      expect.objectContaining({ suggestedName: "SPC Quals.zip" }),
    );
    expect(await entryNames(parts)).toContain("SPC Quals/pack.txt");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("does nothing when the save dialog is cancelled", async () => {
    const picker = vi.fn(async () => {
      throw new DOMException("The user aborted a request.", "AbortError");
    });
    const downloadBlob = vi.fn();
    await expect(saveZip(INPUT, { picker, downloadBlob })).resolves.toBe("cancelled");
    expect(downloadBlob).not.toHaveBeenCalled();
  });

  it("falls back to a download when the dialog is refused (stale click)", async () => {
    const picker = vi.fn(async () => {
      throw new DOMException("Must be handling a user gesture.", "SecurityError");
    });
    const downloadBlob = vi.fn();
    await expect(saveZip(INPUT, { picker, downloadBlob })).resolves.toBe("downloaded");
    expect(downloadBlob).toHaveBeenCalledWith(expect.any(Blob), "SPC Quals.zip");
  });

  it("downloads a Blob where there is no save dialog", async () => {
    const downloadBlob = vi.fn();
    await expect(saveZip(INPUT, { picker: null, downloadBlob })).resolves.toBe("downloaded");
    const [blob] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(blob.type).toBe("application/zip");
    expect(await entryNames(blob)).toContain("SPC Quals/01 NM1 - A - T.osz");
  });
});
