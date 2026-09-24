/**
 * @file tests/unit/utils/date.test.ts
 * @desc Unit tests for formatIsoDate (runs with TZ=America/Los_Angeles, see vitest.config.ts).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { formatIsoDate, formatShortDate } from "@/utils/date";

describe("formatIsoDate", () => {
  it("runs west of UTC so off-by-one bugs would show", () => {
    expect(new Date("2026-09-22T00:00:00Z").getDate()).toBe(21);
  });

  it("formats the calendar date as written, not shifted by the local timezone", () => {
    expect(formatIsoDate("2026-09-22")).toBe("September 22, 2026");
    expect(formatIsoDate("2027-01-01")).toBe("January 1, 2027");
  });

  it.each(["", "Sep 22", "2026-9-22", "2026-09-22T00:00:00Z", "2026-13-01", "2026-02-30"])(
    "rejects %j",
    (input) => {
      expect(() => formatIsoDate(input)).toThrow();
    },
  );
});

describe("formatShortDate", () => {
  it("formats a timestamp's UTC calendar date", () => {
    expect(formatShortDate("2026-09-22T23:30:00.000Z")).toBe("Sep 22, 2026");
  });

  it("throws on something that isn't a date", () => {
    expect(() => formatShortDate("yesterday")).toThrow('not a date: "yesterday"');
  });
});
