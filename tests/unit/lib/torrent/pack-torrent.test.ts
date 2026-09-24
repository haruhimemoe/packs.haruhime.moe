/**
 * @file tests/unit/lib/torrent/pack-torrent.test.ts
 * @desc A pack's torrent holds exactly the zip's files: same folder, names, blobs, pack.txt last.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it, vi } from "vitest";
import { TRACKERS } from "@/constants/trackers";
import type { BuiltTorrent } from "@/lib/torrent/build-torrent";
import { makePackTorrent, packTorrentInput, saveTorrentFile } from "@/lib/torrent/pack-torrent";
import type { ArchivePlan } from "@/utils/pack-archive";

const A = new Blob(["set 10"]);
const B = new Blob(["set 20"]);
const PLAN: ArchivePlan = {
  folder: "SPC Quals",
  zipName: "SPC Quals.zip",
  files: [
    {
      position: 1,
      slot: { mod: "NM", index: 1, beatmapId: 101 },
      setId: 10,
      path: "01 NM1 - A - T.osz",
    },
    {
      position: 2,
      slot: { mod: "NM", index: 2, beatmapId: 102 },
      setId: 20,
      path: "02 NM2 - A - U.osz",
    },
    {
      position: 3,
      slot: { mod: "TB", index: 1, beatmapId: 103 },
      setId: 10,
      path: "03 TB1 - A - V.osz",
    },
  ],
  skipped: [],
  packTxt: "SPC Quals\nポケモン\n",
};
const BLOBS = new Map([
  [10, A],
  [20, B],
]);

describe("packTorrentInput", () => {
  it("uses the plan's folder and file names, the same blobs, and pack.txt last", async () => {
    const input = packTorrentInput({ plan: PLAN, blobs: BLOBS, packKey: "pk1.test" });
    expect(input.name).toBe("SPC Quals");
    expect(input.files.map((f) => f.path)).toEqual([
      "01 NM1 - A - T.osz",
      "02 NM2 - A - U.osz",
      "03 TB1 - A - V.osz",
      "pack.txt",
    ]);
    expect(input.files[0]?.data).toBe(A);
    expect(input.files[1]?.data).toBe(B);
    expect(input.files[2]?.data).toBe(A);
    expect(new Uint8Array(await (input.files[3]?.data ?? new Blob()).arrayBuffer())).toEqual(
      new TextEncoder().encode(PLAN.packTxt),
    );
    expect(input.trackers).toEqual(TRACKERS);
    expect(input.comment).toBe("Made with packs.haruhime.moe. Pack key: pk1.test");
    expect(input.createdBy).toBe("packs.haruhime.moe");
  });

  it("refuses a plan whose set wasn't downloaded", () => {
    expect(() =>
      packTorrentInput({ plan: PLAN, blobs: new Map([[10, A]]), packKey: "pk1.test" }),
    ).toThrow("No download for beatmapset 20");
  });
});

describe("makePackTorrent", () => {
  it("builds the torrent for the pack", async () => {
    const built = await makePackTorrent({ plan: PLAN, blobs: BLOBS, packKey: "pk1.test" });
    expect(built.totalBytes).toBe(3 * 6 + new TextEncoder().encode(PLAN.packTxt).length);
    expect(built.magnet).toContain("&dn=SPC%20Quals&");
  });
});

describe("saveTorrentFile", () => {
  it("downloads {folder}.torrent as application/x-bittorrent", async () => {
    const download = vi.fn();
    const built: BuiltTorrent = {
      torrent: new Uint8Array([100, 101]),
      infoHash: "a".repeat(40),
      magnet: "magnet:?",
      totalBytes: 1,
      pieceLength: 16_384,
    };
    saveTorrentFile(built, PLAN, download);
    const [blob, name] = download.mock.calls[0] as [Blob, string];
    expect(name).toBe("SPC Quals.torrent");
    expect(blob.type).toBe("application/x-bittorrent");
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([100, 101]));
  });
});
