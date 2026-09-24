/**
 * @file tests/unit/lib/zip/pack-zip.test.ts
 * @desc The pack zip: layout, byte-exact entries, pack.txt, exact size prediction, UTF-8 names,
 *       and a clock-proof .osz fixture so the byte-exact check can't straddle a timestamp step.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { strFromU8, unzipSync } from "fflate";
import { afterEach, describe, expect, it, vi } from "vitest";
import { packZipSize, packZipStream } from "@/lib/zip/pack-zip";
import type { Pool } from "@/schemas/pack";
import { planArchive } from "@/utils/pack-archive";
import { fakeOsz } from "../../../helpers/hinai-downloads";

const meta = (beatmapId: number, beatmapsetId: number): BeatmapMeta => ({
  beatmapId,
  beatmapsetId,
  mode: "osu",
  title: `Title ${beatmapId}`,
  artist: "Artist",
  version: "Insane",
  creator: "Mapper",
  creatorId: 1,
  cs: 4,
  ar: 9,
  od: 8,
  hp: 6,
  bpm: 180,
  lengthSeconds: 120,
  starRating: 5,
  checksum: null,
});
const METAS = new Map([
  [1, meta(1, 10)],
  [2, meta(2, 20)],
]);
const pack = (name: string): Pool => ({
  name,
  slots: [
    { mod: "NM", index: 1, beatmapId: 1 },
    { mod: "HD", index: 1, beatmapId: 2 },
  ],
});
const input = (
  name = "SPC Quals",
  blobs = new Map([
    [10, new Blob([fakeOsz(10)])],
    [20, new Blob([fakeOsz(20)])],
  ]),
) => ({
  plan: planArchive({
    pack: pack(name),
    packKey: "pk1.test",
    siteUrl: "https://packs.haruhime.moe",
    getMeta: (id: number) => METAS.get(id) ?? null,
  }),
  blobs,
  lastModified: new Date("2026-09-22T00:00:00Z"),
});
const bytesOf = async (stream: ReadableStream<Uint8Array>) =>
  new Uint8Array(await new Response(stream).arrayBuffer());

afterEach(() => {
  vi.useRealTimers();
});

describe("fakeOsz fixture", () => {
  it("makes the same bytes whatever the clock says (zip timestamps have 2-second steps)", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-22T12:00:00.000Z"));
    const before = fakeOsz(10);
    vi.setSystemTime(new Date("2026-09-22T12:00:02.000Z"));
    expect(fakeOsz(10)).toEqual(before);
  });
});

describe("packZipStream", () => {
  it("puts every slot file and pack.txt in one folder, bytes intact", async () => {
    const zipInput = input();
    const entries = unzipSync(await bytesOf(packZipStream(zipInput)));
    expect(Object.keys(entries).sort()).toEqual([
      "SPC Quals/01 NM1 - Artist - Title 1.osz",
      "SPC Quals/02 HD1 - Artist - Title 2.osz",
      "SPC Quals/pack.txt",
    ]);
    expect(entries["SPC Quals/01 NM1 - Artist - Title 1.osz"]).toEqual(fakeOsz(10));
    expect(strFromU8(entries["SPC Quals/pack.txt"] ?? new Uint8Array())).toBe(
      zipInput.plan.packTxt,
    );
  });

  it("predicts the exact size", async () => {
    const zipInput = input();
    expect(packZipSize(zipInput)).toBe((await bytesOf(packZipStream(zipInput))).byteLength);
  });

  it("keeps a UTF-8 folder name", async () => {
    const entries = unzipSync(await bytesOf(packZipStream(input("春の大会 🌸"))));
    expect(Object.keys(entries).every((name) => name.startsWith("春の大会 🌸/"))).toBe(true);
  });

  it("refuses to build without every planned download", () => {
    expect(() => packZipStream(input("p", new Map([[10, new Blob([fakeOsz(10)])]])))).toThrow(/20/);
  });
});
