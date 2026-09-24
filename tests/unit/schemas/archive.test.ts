/**
 * @file tests/unit/schemas/archive.test.ts
 * @desc Archive details on packs: what parses, https-only source links, the fingerprint shape,
 *       at least one source, and that pack bodies can't carry them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { archiveSourceLinkSchema, packArchiveSchema } from "@/schemas/archive";
import { packInputSchema } from "@/schemas/saved-pack";

const ARCHIVE = {
  tournament: "osu! World Cup 2023",
  round: "Grand Finals",
  year: 2023,
  badged: null,
  fingerprint: "a".repeat(64),
  sources: [
    {
      kind: "otdb",
      id: "657",
      url: "https://otdb.sheppsu.me/db/mappools/657/",
      importedAt: "2026-09-24T12:00:00.000Z",
    },
  ],
};

describe("packArchiveSchema", () => {
  it("parses archive details", () => {
    expect(packArchiveSchema.parse(ARCHIVE)).toEqual(ARCHIVE);
    expect(
      packArchiveSchema.parse({ ...ARCHIVE, round: null, year: null, badged: true }),
    ).toMatchObject({ round: null, year: null, badged: true });
  });

  it.each([
    ["an empty tournament", { tournament: "" }],
    ["a fingerprint that isn't sha256 hex", { fingerprint: "A".repeat(64) }],
    ["a short fingerprint", { fingerprint: "a".repeat(63) }],
    ["no sources", { sources: [] }],
    ["an unknown source", { sources: [{ ...ARCHIVE.sources[0], kind: "osekai" }] }],
    ["an http link", { sources: [{ ...ARCHIVE.sources[0], url: "http://otdb.sheppsu.me/" }] }],
    ["a script link", { sources: [{ ...ARCHIVE.sources[0], url: "javascript:alert(1)" }] }],
  ])("refuses %s", (_label, patch) => {
    expect(packArchiveSchema.safeParse({ ...ARCHIVE, ...patch }).success).toBe(false);
  });
});

describe("archiveSourceLinkSchema", () => {
  it("takes a kind and an https link only", () => {
    expect(
      archiveSourceLinkSchema.safeParse({
        kind: "otdb",
        url: "https://otdb.sheppsu.me/db/mappools/1/",
      }).success,
    ).toBe(true);
    expect(
      archiveSourceLinkSchema.safeParse({ kind: "otdb", url: "ftp://otdb.sheppsu.me/" }).success,
    ).toBe(false);
  });
});

describe("pack bodies", () => {
  it("drop archive details: only the importer writes them", () => {
    const body = packInputSchema.parse({
      name: "Spring Cup Finals",
      slots: [{ mod: "NM", index: 1, beatmapId: 129891 }],
      archive: ARCHIVE,
    });
    expect(body).not.toHaveProperty("archive");
  });
});
