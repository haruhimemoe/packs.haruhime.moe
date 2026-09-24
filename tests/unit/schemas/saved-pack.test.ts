/**
 * @file tests/unit/schemas/saved-pack.test.ts
 * @desc Saved pack schemas: API input defaults and limits, slug shape, response DTOs.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import {
  packInputSchema,
  savedPackSchema,
  savedPackSummarySchema,
  slugSchema,
} from "@/schemas/saved-pack";

const SLOTS = [{ mod: "NM", index: 1, beatmapId: 129891 }];

describe("packInputSchema", () => {
  it("defaults visibility to unlisted and trims the name", () => {
    expect(packInputSchema.parse({ name: "  Finals  ", slots: SLOTS })).toEqual({
      name: "Finals",
      slots: SLOTS,
      visibility: "unlisted",
    });
  });

  it("needs at least one map", () => {
    const result = packInputSchema.safeParse({ name: "Finals", slots: [] });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Add at least one map before saving.");
  });

  it("rejects an unknown visibility", () => {
    expect(
      packInputSchema.safeParse({ name: "F", slots: SLOTS, visibility: "friends" }).success,
    ).toBe(false);
  });

  it("rejects a blank name and duplicate slots", () => {
    expect(packInputSchema.safeParse({ name: "   ", slots: SLOTS }).success).toBe(false);
    expect(packInputSchema.safeParse({ name: "F", slots: [...SLOTS, ...SLOTS] }).success).toBe(
      false,
    );
  });

  it("drops fields the client may not set", () => {
    const parsed = packInputSchema.parse({
      name: "F",
      slots: SLOTS,
      ownerId: "someone-else",
      slug: "chosen1234",
    });
    expect(parsed).not.toHaveProperty("ownerId");
    expect(parsed).not.toHaveProperty("slug");
  });

  it("refuses slurs in the name", () => {
    const result = packInputSchema.safeParse({ name: "f4gg0t pool", slots: SLOTS });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["name"],
      message: "Please keep the name free of slurs.",
    });
  });

  it("refuses slurs in the description", () => {
    const result = packInputSchema.safeParse({
      name: "Finals",
      slots: SLOTS,
      description: "for retards only",
    });
    expect(result.error?.issues[0]).toMatchObject({
      path: ["description"],
      message: "Please keep the description free of slurs.",
    });
  });

  it("lets ordinary names and swearing through", () => {
    expect(packInputSchema.safeParse({ name: "Scunthorpe Cup", slots: SLOTS }).success).toBe(true);
    expect(packInputSchema.safeParse({ name: "fuck this pool", slots: SLOTS }).success).toBe(true);
  });

  it("doesn't run the blocklist on text already over the limit", () => {
    const start = performance.now();
    const result = packInputSchema.safeParse({
      name: "k".repeat(16_000),
      slots: SLOTS,
      description: "n".repeat(16_000),
    });
    expect(result.success).toBe(false);
    expect(performance.now() - start).toBeLessThan(200);
  });
});

describe("slugSchema", () => {
  it.each(["abcdefghij", "A1_-b2C3d4"])("accepts %j", (slug) => {
    expect(slugSchema.safeParse(slug).success).toBe(true);
  });

  it.each(["abcdefghi", "abcdefghijk", "abc/efghij", "../../etc/", "abcdefghi "])(
    "rejects %j",
    (slug) => {
      expect(slugSchema.safeParse(slug).success).toBe(false);
    },
  );
});

describe("response DTOs", () => {
  it("parse a saved pack and a summary", () => {
    const stamp = "2026-09-22T23:30:00.000Z";
    expect(
      savedPackSchema.parse({
        slug: "abcdefghij",
        name: "F",
        slots: SLOTS,
        visibility: "private",
        createdAt: stamp,
        updatedAt: stamp,
      }).visibility,
    ).toBe("private");
    expect(
      savedPackSummarySchema.parse({
        slug: "abcdefghij",
        name: "F",
        slotCount: 1,
        visibility: "public",
        updatedAt: stamp,
      }).slotCount,
    ).toBe(1);
  });
});

describe("descriptions", () => {
  const body = { name: "p", slots: SLOTS };

  it("normalizes line endings and trims", () => {
    expect(packInputSchema.parse({ ...body, description: "  one\r\ntwo  " }).description).toBe(
      "one\ntwo",
    );
  });

  it("allows 500 characters after trimming and refuses 501", () => {
    expect(
      packInputSchema.safeParse({ ...body, description: `  ${"x".repeat(500)}  ` }).success,
    ).toBe(true);
    const tooLong = packInputSchema.safeParse({ ...body, description: "x".repeat(501) });
    expect(tooLong.success).toBe(false);
    expect(tooLong.error?.issues[0]?.message).toBe(
      "Keep the description to 500 characters or fewer.",
    );
  });

  it("leaves the description out when it isn't sent", () => {
    expect(packInputSchema.parse(body).description).toBeUndefined();
  });

  it("carries description and hiddenAt on saved packs, hidden on summaries", () => {
    const saved = savedPackSchema.parse({
      ...body,
      slug: "abcdefghij",
      visibility: "public",
      description: "Quals",
      hiddenAt: "2026-09-22T12:00:00.000Z",
      createdAt: "2026-09-22T00:00:00.000Z",
      updatedAt: "2026-09-22T00:00:00.000Z",
    });
    expect(saved).toMatchObject({ description: "Quals", hiddenAt: "2026-09-22T12:00:00.000Z" });
    expect(
      savedPackSummarySchema.parse({
        slug: "abcdefghij",
        name: "p",
        slotCount: 1,
        visibility: "public",
        hidden: true,
        updatedAt: "2026-09-22T00:00:00.000Z",
      }).hidden,
    ).toBe(true);
  });
});
