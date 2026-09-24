/**
 * @file src/constants/trackers.ts
 * @desc Public trackers every pack torrent lists: UDP for desktop clients (qBittorrent and co.),
 *       WebSocket for browser clients (WebTorrent). We run none; update this list when one dies.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

export const TRACKERS: readonly string[] = [
  "udp://tracker.opentrackr.org:1337/announce",
  "udp://open.stealth.si:80/announce",
  "udp://tracker.torrent.eu.org:451/announce",
  "udp://exodus.desync.com:6969/announce",
  "udp://open.demonii.com:1337/announce",
  "wss://tracker.openwebtorrent.com",
  "wss://tracker.webtorrent.dev",
];
