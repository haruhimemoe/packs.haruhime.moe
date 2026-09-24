/**
 * @file tests/unit/schemas/pools-service.test.ts
 * @desc The pools service's ref (a pools pool id) and PUT body: exactly a pack input, unknown keys
 *       refused, visibility required, and every pack input rule still applied.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { poolsPackBodySchema, poolsRefSchema } from "@/schemas/pools-service";
import { packInputSchema } from "@/schemas/saved-pack";

const BODY = {
  name: "Ricma 2 Quarterfinals",
  visibility: "public",
  slots: [{ mod: "NM", index: 1, beatmapId: 101 }],
};

describe("poolsRefSchema", () => {
  it.each(["otdb-58", "otdb-58-2", "a", "a".repeat(64)])("takes %j", (ref) => {
    expect(poolsRefSchema.safeParse(ref).success).toBe(true);
  });

  it.each(["", "OTDB-58", "otdb_58", "otdb 58", "a".repeat(65), "../x"])("refuses %j", (ref) => {
    expect(poolsRefSchema.safeParse(ref).success).toBe(false);
  });
});

describe("poolsPackBodySchema", () => {
  it("parses a pack input exactly as packInputSchema does", () => {
    const body = { ...BODY, description: "Ricma 2\r\nQuarterfinals  " };
    expect(poolsPackBodySchema.parse(body)).toEqual(packInputSchema.parse(body));
  });

  it("refuses a key a pack input doesn't have", () => {
    const issue = poolsPackBodySchema.safeParse({ ...BODY, year: 2023 }).error?.issues[0];
    expect(issue).toMatchObject({ code: "unrecognized_keys", keys: ["year"] });
  });

  it("requires visibility instead of defaulting it", () => {
    const { visibility: _visibility, ...rest } = BODY;
    const issue = poolsPackBodySchema.safeParse(rest).error?.issues[0];
    expect(issue).toMatchObject({ path: ["visibility"] });
  });

  it("still applies the content filter and the pack rules", () => {
    expect(poolsPackBodySchema.safeParse({ ...BODY, name: "f4gg0t pool" }).success).toBe(false);
    expect(poolsPackBodySchema.safeParse({ ...BODY, slots: [] }).success).toBe(false);
    expect(poolsPackBodySchema.safeParse("a string").success).toBe(false);
  });
});
