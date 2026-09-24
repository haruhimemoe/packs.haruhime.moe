/**
 * @file tests/unit/schemas/pack-export.test.ts
 * @desc Magnet links recorded on saved packs: what the API accepts and returns.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { MAX_MAGNET_LENGTH, MAX_PACK_EXPORTS } from "@/constants/pack";
import { magnetSchema, packExportInputSchema, packExportsSchema } from "@/schemas/pack-export";

const HASH = "d63ba49c4cbf76ee46bfc94476183f1710de7d09";
const MAGNET = `magnet:?xt=urn:btih:${HASH}&dn=SPC`;

describe("magnetSchema", () => {
  it("accepts a v1 magnet link", () => {
    expect(magnetSchema.parse(MAGNET)).toBe(MAGNET);
  });

  it.each([
    `javascript:alert(1)//magnet:?xt=urn:btih:${HASH}`,
    `magnet:?xt=urn:btih:${HASH}&xt=urn:btih:${HASH}`,
    "magnet:?dn=only-a-name",
    "",
  ])("rejects %j", (url) => {
    expect(magnetSchema.safeParse(url).success).toBe(false);
  });

  it(`allows ${MAX_MAGNET_LENGTH} characters, not one more`, () => {
    const pad = (length: number) => `${MAGNET}&tr=${"a".repeat(length - MAGNET.length - 4)}`;
    expect(magnetSchema.safeParse(pad(MAX_MAGNET_LENGTH)).success).toBe(true);
    expect(magnetSchema.safeParse(pad(MAX_MAGNET_LENGTH + 1)).success).toBe(false);
  });
});

describe("packExportInputSchema", () => {
  it("takes a magnet kind, url, and the pack key it was made from", () => {
    const body = { kind: "magnet", url: MAGNET, packKey: "pk1.test" };
    expect(packExportInputSchema.parse(body)).toEqual(body);
    expect(packExportInputSchema.safeParse({ kind: "magnet", url: MAGNET }).success).toBe(false);
  });

  it("rejects other kinds and extra keys", () => {
    expect(
      packExportInputSchema.safeParse({ kind: "gdrive", url: MAGNET, packKey: "k" }).success,
    ).toBe(false);
    expect(
      packExportInputSchema.safeParse({ kind: "magnet", url: MAGNET, packKey: "k", createdAt: "x" })
        .success,
    ).toBe(false);
  });
});

describe("packExportsSchema", () => {
  it(`holds at most ${MAX_PACK_EXPORTS}`, () => {
    const entry = { kind: "magnet", url: MAGNET, createdAt: "2026-09-22T00:00:00.000Z" };
    expect(packExportsSchema.safeParse(Array(MAX_PACK_EXPORTS).fill(entry)).success).toBe(true);
    expect(packExportsSchema.safeParse(Array(MAX_PACK_EXPORTS + 1).fill(entry)).success).toBe(
      false,
    );
  });
});
