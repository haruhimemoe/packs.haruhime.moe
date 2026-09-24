/**
 * @file tests/unit/constants/trackers.test.ts
 * @desc Tracker list: UDP for desktop clients, WebSocket for browser clients, no duplicates.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { TRACKERS } from "@/constants/trackers";

describe("TRACKERS", () => {
  it("lists UDP trackers first, then WebSocket trackers", () => {
    expect(TRACKERS.filter((t) => t.startsWith("udp://"))).toHaveLength(5);
    expect(TRACKERS.filter((t) => t.startsWith("wss://"))).toHaveLength(2);
    expect(TRACKERS[0]).toBe("udp://tracker.opentrackr.org:1337/announce");
    expect(TRACKERS.at(-1)).toBe("wss://tracker.webtorrent.dev");
  });

  it("has no duplicates", () => {
    expect(new Set(TRACKERS).size).toBe(TRACKERS.length);
  });
});
