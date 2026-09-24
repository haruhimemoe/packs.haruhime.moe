/**
 * @file tests/types/parse-torrent.d.ts
 * @desc Types for parse-torrent (ships none). Dev-only: tests use it to check our torrents.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

declare module "parse-torrent" {
  export type ParsedTorrent = {
    infoHash: string;
    name?: string;
    announce?: string[];
    comment?: string;
    createdBy?: string;
    created?: Date;
    files?: { path: string; name: string; length: number; offset: number }[];
    length?: number;
    pieceLength?: number;
    lastPieceLength?: number;
    pieces?: string[];
    xl?: string;
  };
  export default function parseTorrent(input: string | Uint8Array): Promise<ParsedTorrent>;
}
