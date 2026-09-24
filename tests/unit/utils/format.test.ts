/**
 * @file tests/unit/utils/format.test.ts
 * @desc Number formatting for beatmap stats.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import {
  formatBpm,
  formatBytes,
  formatDuration,
  formatLongDuration,
  formatStars,
  formatStat,
} from "@/utils/format";

describe("format", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [258, "4:18"],
    [3600, "60:00"],
    [239.6, "4:00"],
  ])("formatDuration(%d) = %s", (s, out) => {
    expect(formatDuration(s)).toBe(out);
  });

  it("formatStat trims float noise to one decimal", () => {
    expect(formatStat(3.799999952316284)).toBe("3.8");
    expect(formatStat(9)).toBe("9");
    expect(formatStat(0)).toBe("0");
  });

  it("formatBpm rounds", () => {
    expect(formatBpm(222.22000122070312)).toBe("222");
  });

  it("formatStars keeps two decimals", () => {
    expect(formatStars(7.805789947509766)).toBe("7.81");
    expect(formatStars(5)).toBe("5.00");
  });
});

describe("formatBytes", () => {
  it.each([
    [0, "0 B"],
    [512, "512 B"],
    [2048, "2.0 KB"],
    [6_950_251, "6.6 MB"],
    [1_500_000_000, "1.4 GB"],
    [15 * 1024 ** 3, "15 GB"],
  ])("%d bytes → %s", (bytes, text) => {
    expect(formatBytes(bytes)).toBe(text);
  });
});

describe("formatLongDuration", () => {
  it.each([
    [59, "0:59"],
    [3599, "59:59"],
    [3600, "1:00:00"],
    [3725.4, "1:02:05"],
  ])("%d → %s", (seconds, text) => {
    expect(formatLongDuration(seconds)).toBe(text);
  });
});
