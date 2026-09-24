/**
 * @file tests/unit/utils/pack-archive.test.ts
 * @desc Zip layout: safe file names on every OS, numbering, skipped maps, pack.txt contents.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { BeatmapMeta } from "@haruhimemoe/osu/shapes";
import { describe, expect, it } from "vitest";
import type { Pool } from "@/schemas/pack";
import { MAX_FILE_STEM, planArchive, sanitizeFileName } from "@/utils/pack-archive";

const meta = (
  beatmapId: number,
  beatmapsetId: number,
  over: Partial<BeatmapMeta> = {},
): BeatmapMeta => ({
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
  ...over,
});

const PACK: Pool = {
  name: "SPC Quals",
  slots: [
    { mod: "TB", index: 1, beatmapId: 3 },
    { mod: "NM", index: 1, beatmapId: 1 },
    { mod: "NM", index: 2, beatmapId: 2 },
  ],
};
const METAS = new Map([
  [1, meta(1, 10)],
  [2, meta(2, 20)],
  [3, meta(3, 30)],
]);
const plan = (over: Partial<Parameters<typeof planArchive>[0]> = {}) =>
  planArchive({
    pack: PACK,
    packKey: "pk1.test",
    siteUrl: "https://packs.haruhime.moe",
    getMeta: (id) => METAS.get(id) ?? null,
    ...over,
  });

describe("sanitizeFileName", () => {
  it.each([
    ['a/b\\c:d*e?f"g<h>i|j', "a_b_c_d_e_f_g_h_i_j"],
    ["trailing dots... ", "trailing dots"],
    ["...hidden", "hidden"],
    ["tab\tand\nnewline", "tab and newline"],
    ["bell\u0007", "bell_"],
    ["CON", "_CON"],
    ["con.txt", "_con.txt"],
    ["COM10", "COM10"],
    ["LPT¹", "_LPT¹"],
    ["CONIN$", "_CONIN$"],
    ["", "_"],
    ["   ", "_"],
    ["春の大会 🌸", "春の大会 🌸"],
  ])("%j → %j", (input, output) => {
    expect(sanitizeFileName(input)).toBe(output);
  });

  it("truncates by characters without splitting an emoji", () => {
    expect(sanitizeFileName("🌸".repeat(200))).toBe("🌸".repeat(MAX_FILE_STEM));
  });
});

describe("planArchive", () => {
  it("numbers slots in pool order inside one folder", () => {
    const result = plan();
    expect(result.folder).toBe("SPC Quals");
    expect(result.zipName).toBe("SPC Quals.zip");
    expect(result.files.map((f) => [f.path, f.setId])).toEqual([
      ["01 NM1 - Artist - Title 1.osz", 10],
      ["02 NM2 - Artist - Title 2.osz", 20],
      ["03 TB1 - Artist - Title 3.osz", 30],
    ]);
    expect(result.skipped).toEqual([]);
  });

  it("makes titles with illegal characters safe", () => {
    const result = plan({
      getMeta: (id) =>
        id === 1 ? meta(1, 10, { title: "Re:Zero / Op?" }) : (METAS.get(id) ?? null),
    });
    expect(result.files[0]?.path).toBe("01 NM1 - Artist - Re_Zero _ Op_.osz");
  });

  it("keeps the extension on very long titles", () => {
    const result = plan({ getMeta: (id) => meta(id, id * 10, { title: "x".repeat(300) }) });
    for (const file of result.files) {
      expect(file.path.endsWith(".osz")).toBe(true);
      expect(file.path.length).toBeLessThanOrEqual(MAX_FILE_STEM + 4);
    }
  });

  it("keeps extracted paths well under Windows MAX_PATH, even when Explorer nests the folder", () => {
    const result = plan({
      pack: { ...PACK, name: "N".repeat(200) },
      getMeta: (id) => meta(id, id * 10, { title: "x".repeat(300) }),
    });
    for (const file of result.files) {
      expect(result.folder.length * 2 + file.path.length).toBeLessThanOrEqual(200);
    }
  });

  it("falls back to the default name for an empty pack name", () => {
    expect(plan({ pack: { ...PACK, name: "  " } }).folder).toBe("Untitled pack");
  });

  it("leaves out maps the mirror didn't know, keeping the numbering", () => {
    const result = plan({ getMeta: (id) => (id === 2 ? null : (METAS.get(id) ?? null)) });
    expect(result.files.map((f) => f.position)).toEqual([1, 3]);
    expect(result.skipped).toEqual([
      { position: 2, slot: { mod: "NM", index: 2, beatmapId: 2 }, reason: "missing" },
    ]);
    expect(result.packTxt).toContain("beatmap 2");
    expect(result.packTxt).toContain("not included: not found on the mirror");
  });

  it("leaves out every slot whose set failed to download", () => {
    const shared = new Map([
      [1, meta(1, 10)],
      [2, meta(2, 10)],
      [3, meta(3, 30)],
    ]);
    const result = plan({ getMeta: (id) => shared.get(id) ?? null, failedSetIds: new Set([10]) });
    expect(result.files.map((f) => f.position)).toEqual([3]);
    expect(result.skipped.map((s) => [s.position, s.reason])).toEqual([
      [1, "failed"],
      [2, "failed"],
    ]);
    expect(result.packTxt).toContain("not included: the download failed");
  });

  it("writes the key, a share link, and the listing into pack.txt", () => {
    const text = plan().packTxt;
    expect(text.split("\n")[0]).toBe("SPC Quals");
    expect(text).toContain("Pack key: pk1.test");
    expect(text).toContain("https://packs.haruhime.moe/k#pk1.test");
    expect(text).toContain("01  NM1  Artist - Title 1 [Insane] (mapped by Mapper)");
    expect(text).toContain("https://osu.ppy.sh/beatmaps/3");
  });

  it("credits whoever made the pack, since pack.txt ships in the zip and the torrent", () => {
    expect(plan().packTxt).toContain(
      "Beatmaps were downloaded from mirror.hinamizawa.ai by whoever made this pack.",
    );
  });

  it("labels custom buckets and leaves no-slot maps unlabelled, in pool order", () => {
    const result = plan({
      pack: {
        name: "Custom",
        slots: [
          { mod: "難", index: 1, beatmapId: 1 },
          { mod: null, index: 1, beatmapId: 2 },
          { mod: "RC1", index: 2, beatmapId: 3 },
        ],
        buckets: [
          { code: "NM" },
          { code: "HD" },
          { code: "HR" },
          { code: "DT" },
          { code: "FM" },
          { code: "難", color: 3 },
          { code: "RC1", color: 1 },
          { code: "TB" },
        ],
      },
    });
    expect(result.files.map((f) => f.path)).toEqual([
      "01 - Artist - Title 2.osz",
      "02 難1 - Artist - Title 1.osz",
      "03 RC1 2 - Artist - Title 3.osz",
    ]);
    expect(result.packTxt).toContain("01        Artist - Title 2 [Insane]");
    expect(result.packTxt).toContain("02  難1    Artist - Title 1 [Insane]");
    expect(result.packTxt).toContain("03  RC1 2 Artist - Title 3 [Insane]");
  });

  it("says in pack.txt what the downloads include, right under the share link", () => {
    const lines = plan().packTxt.split("\n");
    expect(lines[4]).toMatch(/^Open it: /);
    expect(lines[5]).toBe("Videos: not included. Backgrounds: included.");
    expect(plan({ choices: { videos: true, backgrounds: false } }).packTxt).toContain(
      "Videos: included. Backgrounds: removed.",
    );
  });

  it("notes each map whose background couldn't be removed", () => {
    const text = plan({
      choices: { videos: false, backgrounds: false },
      backgroundsKeptSetIds: new Set([20]),
    }).packTxt;
    expect(text).toContain(
      "02  NM2  Artist - Title 2 [Insane] (mapped by Mapper)\n      background kept: couldn't remove it\n",
    );
    expect(text.match(/background kept/g)).toHaveLength(1);
  });
});
