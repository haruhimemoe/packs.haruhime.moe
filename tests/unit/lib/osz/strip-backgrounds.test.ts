/**
 * @file tests/unit/lib/osz/strip-backgrounds.test.ts
 * @desc Background removal round trip on synthetic .osz files: backgrounds gone, every other entry
 *       (every .osu above all, checked by MD5) byte-identical and in order, copied still compressed
 *       (local header, data and data descriptor), images and audio never inflated, deterministic,
 *       exact name bytes, readable by fflate, refusals of damaged archives, abort.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { createHash } from "node:crypto";
import { unzipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { stripBackgrounds } from "@/lib/osz/strip-backgrounds";
import {
  locateLocalEntry,
  OszRewriteError,
  readZipDirectory,
  readZipEntryNames,
  writableName,
} from "@/lib/osz/zip-names";
import {
  type FixtureEntry,
  makeOsz,
  makeStreamedOsz,
  noise,
  osuFile,
  replaceNameBytes,
} from "../../../helpers/osz-fixtures";

const md5 = (bytes: Uint8Array) => createHash("md5").update(bytes).digest("hex");
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());
const names = (zip: Uint8Array) => readZipEntryNames(zip).map((entry) => writableName(entry.raw));
const MP3 = [...new TextEncoder().encode(".mp3")];
const viewOf = (zip: Uint8Array) => new DataView(zip.buffer, zip.byteOffset, zip.byteLength);

/** Each entry's local bytes (header, name, extra, data, descriptor) and its directory record with
 *  the local header offset zeroed, keyed by name. */
const pieces = (zip: Uint8Array) =>
  new Map(
    readZipDirectory(zip).entries.map((entry) => {
      const { start, end } = locateLocalEntry(zip, entry);
      const record = new Uint8Array(entry.record);
      viewOf(record).setUint32(42, 0, true);
      return [entry.key, { local: zip.slice(start, end), record }] as const;
    }),
  );

const expectCopied = (input: Uint8Array, output: Uint8Array) => {
  const before = pieces(input);
  const after = pieces(output);
  expect(after.size).toBeGreaterThan(0);
  for (const [name, piece] of after) {
    expect(piece.local).toEqual(before.get(name)?.local);
    expect(piece.record).toEqual(before.get(name)?.record);
  }
};

const HARD = osuFile(['0,0,"bg.jpg",0,0', 'Video,0,"clip.mp4"'], "Hard");
const INSANE = osuFile(['0,0,"SB\\Insane BG.PNG",0,0'], "Insane");
const OSB = '[Events]\r\nSprite,Background,Centre,"sb/star.png",320,240\r\n';

const SET: FixtureEntry[] = [
  ["Artist - Title (Mapper) [Hard].osu", HARD],
  ["audio.mp3", noise(4000, 1)],
  ["bg.jpg", noise(3000, 2)],
  ["Artist - Title (Mapper) [Insane].osu", INSANE],
  ["sb/insane bg.png", noise(2000, 3)],
  ["sb/star.png", noise(500, 4)],
  ["Artist - Title (Mapper).osb", OSB],
  ["normal-hitclap.wav", noise(800, 5)],
];

describe("stripBackgrounds", () => {
  it("drops the backgrounds, keeps everything else byte for byte and in order", async () => {
    const input = makeOsz(SET);
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    const before = unzipSync(input);
    const after = unzipSync(output);

    expect(names(output)).toEqual([
      "Artist - Title (Mapper) [Hard].osu",
      "audio.mp3",
      "Artist - Title (Mapper) [Insane].osu",
      "sb/star.png",
      "Artist - Title (Mapper).osb",
      "normal-hitclap.wav",
    ]);
    for (const name of names(output)) {
      expect(after[name]).toEqual(before[name]);
    }
    // osu! matches maps to leaderboards and lobbies by the .osu file's MD5.
    for (const name of names(output).filter((n) => n.endsWith(".osu"))) {
      expect(md5(after[name] as Uint8Array)).toBe(md5(before[name] as Uint8Array));
    }
  });

  it("copies every kept entry as it was, still compressed", async () => {
    const input = makeOsz(SET);
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    expectCopied(input, output);
    expect(readZipDirectory(output).entries.every((entry) => entry.method === 8)).toBe(true);
  });

  it("writes a directory that points at the copied entries, and no comment", async () => {
    const input = makeOsz(SET);
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    const view = viewOf(output);
    const end = output.length - 22;
    const { entries, directoryOffset } = readZipDirectory(output);
    expect(view.getUint32(end, true)).toBe(0x06054b50);
    expect(view.getUint16(end + 8, true)).toBe(6);
    expect(view.getUint16(end + 10, true)).toBe(6);
    expect(view.getUint32(end + 12, true)).toBe(end - directoryOffset);
    expect(view.getUint16(end + 20, true)).toBe(0);
    expect(entries[0]?.localHeaderOffset).toBe(0);
    for (const entry of entries) expect(locateLocalEntry(output, entry).start).toBeDefined();
  });

  it.each([
    ["with", true],
    ["without", false],
  ])("copies entries that end in a data descriptor %s its signature", async (_, signature) => {
    const input = makeStreamedOsz(SET, { signature });
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    expect(names(output)).toEqual(names(makeOsz(SET)).filter((n) => !/bg\.(jpg|png)$/.test(n)));
    expectCopied(input, output);
    const before = unzipSync(input);
    const after = unzipSync(output);
    for (const name of names(output)) expect(after[name]).toEqual(before[name]);
  });

  it("never inflates audio or images, only .osu and .osb", async () => {
    const input = makeOsz(SET);
    const audio = readZipDirectory(input).entries.find((entry) => entry.key === "audio.mp3");
    if (!audio) throw new Error("missing audio");
    // BTYPE 11 is an invalid deflate block: inflating this entry would throw.
    input[locateLocalEntry(input, audio).dataStart] = 0xff;
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    expect(names(output)).toContain("audio.mp3");
    expectCopied(input, output);
  });

  it("rejects a kept entry whose local header offset points past the archive", async () => {
    const input = makeOsz(SET);
    const { directoryOffset } = readZipDirectory(input);
    viewOf(input).setUint32(directoryOffset + 42, input.length + 100, true);
    await expect(stripBackgrounds(new Blob([input]))).rejects.toBeInstanceOf(OszRewriteError);
  });

  it("refuses a set with zip64 local headers, so the caller keeps it as downloaded", async () => {
    const input = makeStreamedOsz(SET, { signature: true, zip64: true });
    await expect(stripBackgrounds(new Blob([input]))).rejects.toBeInstanceOf(OszRewriteError);
  });

  it("rejects entries whose bytes overlap", async () => {
    const input = makeOsz([
      ["a.osu", osuFile(['0,0,"bg.jpg",0,0'])],
      ["audio.mp3", noise(100, 1)],
      ["hit.wav", noise(100, 2)],
      ["bg.jpg", noise(10, 3)],
    ]);
    const { entries, directoryOffset } = readZipDirectory(input);
    const [osu, audio, hit] = entries;
    if (!osu || !audio || !hit) throw new Error("missing entry");
    // hit.wav's record now points at audio.mp3's local header too.
    const hitRecord = directoryOffset + osu.record.length + audio.record.length;
    viewOf(input).setUint32(hitRecord + 42, audio.localHeaderOffset, true);
    await expect(stripBackgrounds(new Blob([input]))).rejects.toBeInstanceOf(OszRewriteError);
  });

  it("gives the same bytes every time, so the torrent stays the same", async () => {
    const input = makeOsz(SET);
    const first = await bytesOf(await stripBackgrounds(new Blob([input])));
    const second = await bytesOf(await stripBackgrounds(new Blob([input])));
    expect(second).toEqual(first);
  });

  it("hands back the original when there is no background to drop", async () => {
    const blob = new Blob([
      makeOsz([
        ["a.osu", osuFile([])],
        ["audio.mp3", noise(10)],
      ]),
    ]);
    expect(await stripBackgrounds(blob)).toBe(blob);
  });

  it("keeps the exact bytes of a UTF-8 name that lacks the UTF-8 flag", async () => {
    // "曲" is E6 9B B2 in UTF-8; the ASCII placeholder keeps fflate from setting the flag.
    const input = replaceNameBytes(
      makeOsz([
        ["a.osu", osuFile(['0,0,"bg.jpg",0,0'])],
        ["QQQ.mp3", noise(10)],
        ["bg.jpg", noise(10)],
      ]),
      "QQQ.mp3",
      [0xe6, 0x9b, 0xb2, ...MP3],
    );
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    expect(names(output)).toEqual(["a.osu", "曲.mp3"]);
    // Copied as it was: still unflagged, so fflate keys it as latin1, the same as the input.
    const [, audio] = readZipEntryNames(output);
    expect(audio?.key).toBe(readZipEntryNames(input)[1]?.key);
    expect(unzipSync(output)[audio?.key ?? ""]).toEqual(noise(10));
  });

  it("drops a UTF-8 background name that lacks the UTF-8 flag", async () => {
    // fflate keys this entry as latin1 mojibake; the .osu spells it "曲.jpg".
    const input = replaceNameBytes(
      makeOsz([
        ["a.osu", osuFile(['0,0,"曲.jpg",0,0'])],
        ["audio.mp3", noise(10)],
        ["QQQ.jpg", noise(10)],
      ]),
      "QQQ.jpg",
      [0xe6, 0x9b, 0xb2, ...new TextEncoder().encode(".jpg")],
    );
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    expect(names(output)).toEqual(["a.osu", "audio.mp3"]);
  });

  it("refuses a name that isn't UTF-8 rather than rename the file", async () => {
    // 82 A0 is "あ" in Shift-JIS and not valid UTF-8.
    const input = replaceNameBytes(
      makeOsz([
        ["a.osu", osuFile(['0,0,"bg.jpg",0,0'])],
        ["QQ.mp3", noise(10)],
        ["bg.jpg", noise(10)],
      ]),
      "QQ.mp3",
      [0x82, 0xa0, ...MP3],
    );
    await expect(stripBackgrounds(new Blob([input]))).rejects.toBeInstanceOf(OszRewriteError);
  });

  it("leaves a set with a non-UTF-8 name alone when there's nothing to drop", async () => {
    const blob = new Blob([
      replaceNameBytes(
        makeOsz([
          ["a.osu", osuFile([])],
          ["QQ.mp3", noise(10)],
        ]),
        "QQ.mp3",
        [0x82, 0xa0, ...MP3],
      ),
    ]);
    expect(await stripBackgrounds(blob)).toBe(blob);
  });

  it("rejects something that isn't a zip", async () => {
    await expect(stripBackgrounds(new Blob(["<html>oops</html>"]))).rejects.toBeInstanceOf(
      OszRewriteError,
    );
  });

  it("reads a big .osu", async () => {
    const big = osuFile([
      '0,0,"bg.jpg",0,0',
      ...Array.from({ length: 50_000 }, (_, i) => `// line ${i}`),
    ]);
    expect(big.length).toBeGreaterThan(600_000);
    const input = makeOsz([
      ["big.osu", big],
      ["bg.jpg", noise(10)],
    ]);
    const output = await bytesOf(await stripBackgrounds(new Blob([input])));
    expect(names(output)).toEqual(["big.osu"]);
    expect(unzipSync(output)["big.osu"]).toEqual(unzipSync(input)["big.osu"]);
    // About a second alone, but past the 5 s default on a busy CI runner with coverage on.
  }, 30_000);

  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      stripBackgrounds(new Blob([makeOsz(SET)]), { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("stops when aborted while the set is being read", async () => {
    const controller = new AbortController();
    const blob = new Blob([makeOsz(SET)]);
    const reading = {
      arrayBuffer: async () => {
        const buffer = await blob.arrayBuffer();
        controller.abort();
        return buffer;
      },
    } as Blob;
    await expect(stripBackgrounds(reading, { signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
