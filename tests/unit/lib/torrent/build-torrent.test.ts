/**
 * @file tests/unit/lib/torrent/build-torrent.test.ts
 * @desc Torrent builder: piece size rule, pieces across file boundaries, known infohashes, and
 *       parse-torrent agreeing with every field we write, and our magnet surviving canonicalMagnet.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { createHash } from "node:crypto";
import parseTorrent from "parse-torrent";
import { describe, expect, it } from "vitest";
import { TRACKERS } from "@/constants/trackers";
import {
  buildTorrent,
  canHashInBrowser,
  MAX_PIECE_LENGTH,
  MIN_PIECE_LENGTH,
  pieceLengthFor,
  type TorrentFile,
} from "@/lib/torrent/build-torrent";
import { canonicalMagnet } from "@/utils/magnet";

const bytes = (length: number, seed: number): Blob =>
  new Blob([Uint8Array.from({ length }, (_, i) => (i * 7 + seed) % 256)]);

const FILES: TorrentFile[] = [
  { path: "01 NM1 - Artist - Title.osz", data: bytes(20_000, 1) },
  { path: "02 - Empty.osz", data: new Blob([]) },
  { path: "03 HD1 - アーティスト - 曲.osz", data: bytes(30_000, 2) },
  { path: "pack.txt", data: new Blob(["hello"]) },
];
const TOTAL = 50_005;

describe("pieceLengthFor", () => {
  it.each([
    [0, MIN_PIECE_LENGTH],
    [1500 * MIN_PIECE_LENGTH, MIN_PIECE_LENGTH],
    [1500 * MIN_PIECE_LENGTH + 1, 2 * MIN_PIECE_LENGTH],
    [3_000_000_000, 2 * 1024 * 1024],
    [1e13, MAX_PIECE_LENGTH],
  ])("%d bytes → %d", (total, expected) => {
    expect(pieceLengthFor(total)).toBe(expected);
  });
});

describe("buildTorrent", () => {
  const build = () =>
    buildTorrent({
      name: "SPC Quals",
      files: FILES,
      trackers: TRACKERS,
      comment: "Made with packs.haruhime.moe. Pack key: pk1.test",
      createdBy: "packs.haruhime.moe",
      creationDate: new Date("2026-09-22T00:00:00Z"),
    });

  it("writes a torrent parse-torrent reads back field for field", async () => {
    const built = await build();
    const parsed = await parseTorrent(built.torrent);
    expect(parsed.infoHash).toBe(built.infoHash);
    expect(parsed.name).toBe("SPC Quals");
    expect(parsed.files?.map((f) => [f.name, f.length])).toEqual(
      FILES.map((f) => [f.path, f.data.size]),
    );
    expect(parsed.length).toBe(TOTAL);
    expect(built.totalBytes).toBe(TOTAL);
    expect(parsed.pieceLength).toBe(MIN_PIECE_LENGTH);
    expect(built.pieceLength).toBe(MIN_PIECE_LENGTH);
    expect(parsed.lastPieceLength).toBe(TOTAL - 3 * MIN_PIECE_LENGTH);
    expect(parsed.announce).toEqual([...TRACKERS]);
    expect(parsed.comment).toBe("Made with packs.haruhime.moe. Pack key: pk1.test");
    expect(parsed.createdBy).toBe("packs.haruhime.moe");
    expect(parsed.created?.toISOString()).toBe("2026-09-22T00:00:00.000Z");
  });

  it("hashes pieces across file boundaries", async () => {
    const built = await build();
    const all = Buffer.concat(
      await Promise.all(FILES.map(async (f) => Buffer.from(await f.data.arrayBuffer()))),
    );
    const expected: string[] = [];
    for (let offset = 0; offset < all.length; offset += MIN_PIECE_LENGTH) {
      expected.push(
        createHash("sha1")
          .update(all.subarray(offset, offset + MIN_PIECE_LENGTH))
          .digest("hex"),
      );
    }
    expect((await parseTorrent(built.torrent)).pieces).toEqual(expected);
  });

  it("gives a magnet link with the same hash, name, size, and trackers", async () => {
    const built = await build();
    const magnet = await parseTorrent(built.magnet);
    expect(magnet.infoHash).toBe(built.infoHash);
    expect(magnet.name).toBe("SPC Quals");
    expect(magnet.announce).toEqual([...TRACKERS]);
    expect(built.magnet).toContain(`&xl=${TOTAL}&`);
  });

  it.each(["SPC Quals", "Pokémon Cup [ポケモン] & Co"])(
    "gives a magnet the server stores unchanged (%s)",
    async (name) => {
      const built = await buildTorrent({ name, files: FILES, trackers: TRACKERS });
      expect(canonicalMagnet(built.magnet)).toBe(built.magnet);
    },
  );

  it.each([
    ["Fixture", "d63ba49c4cbf76ee46bfc94476183f1710de7d09"],
    ["Pokémon Cup", "73a0fe2414efbd654c705102f4416f1ecf97f5f7"],
  ])("matches a hand-computed infohash for %s", async (name, hash) => {
    const built = await buildTorrent({
      name,
      files: [
        { path: "a.osz", data: new Blob(["hello"]) },
        { path: "pack.txt", data: new Blob(["world\n"]) },
      ],
      trackers: [],
    });
    expect(built.infoHash).toBe(hash);
  });

  it("doesn't let the creation date change the infohash", async () => {
    const input = { name: "X", files: [{ path: "a", data: new Blob(["a"]) }], trackers: [] };
    const a = await buildTorrent({ ...input, creationDate: new Date(0) });
    const b = await buildTorrent({ ...input, creationDate: new Date(1e12) });
    expect(a.infoHash).toBe(b.infoHash);
  });

  it("reports progress after each piece", async () => {
    const seen: [number, number][] = [];
    await buildTorrent(
      { name: "X", files: FILES, trackers: [] },
      { onProgress: (hashed, total) => seen.push([hashed, total]) },
    );
    expect(seen).toEqual([
      [16_384, TOTAL],
      [32_768, TOTAL],
      [49_152, TOTAL],
      [TOTAL, TOTAL],
    ]);
  });

  it("stops when aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      buildTorrent({ name: "X", files: FILES, trackers: [] }, { signal: controller.signal }),
    ).rejects.toThrow();
  });
});

describe("canHashInBrowser", () => {
  it("is true where crypto.subtle exists", () => {
    expect(canHashInBrowser()).toBe(true);
  });
});
