/**
 * @file tests/unit/utils/account-export.test.ts
 * @desc Download file name for "Download my data": username and UTC date, safe in a
 *       Content-Disposition header whatever the username holds.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { accountExportFileName } from "@/utils/account-export";

const AT = new Date("2026-09-22T12:00:00Z");

describe("accountExportFileName", () => {
  it("names the file after the username and the date", () => {
    expect(accountExportFileName("peppy", AT)).toBe("packs-data-peppy-2026-09-22.json");
  });

  it("keeps osu!'s own username characters: letters, digits, - _ [ ]", () => {
    expect(accountExportFileName("-GN_[JP]", AT)).toBe("packs-data--GN_[JP]-2026-09-22.json");
  });

  it("turns each run of other characters into one underscore", () => {
    expect(accountExportFileName('Mr  Fish "x"', AT)).toBe("packs-data-Mr_Fish_x_-2026-09-22.json");
    expect(accountExportFileName("ぺっぴー", AT)).toBe("packs-data-_-2026-09-22.json");
  });

  it("never returns an empty name part", () => {
    expect(accountExportFileName("", AT)).toBe("packs-data-_-2026-09-22.json");
  });

  it("uses the UTC date, not the server's local one", () => {
    // Unit tests run in America/Los_Angeles, where this instant is still Sep 22.
    expect(accountExportFileName("peppy", new Date("2026-09-23T02:00:00Z"))).toBe(
      "packs-data-peppy-2026-09-23.json",
    );
  });

  it.each(["ぺっぴー", 'a"b', "Mr Fish [JP]"])("is a valid header value for %j", (username) => {
    const name = accountExportFileName(username, AT);
    expect(
      () => new Headers({ "Content-Disposition": `attachment; filename="${name}"` }),
    ).not.toThrow();
    expect(name).toMatch(/^[\x20-\x7e]+$/);
    expect(name).not.toContain('"');
  });
});
