/**
 * @file tests/unit/lib/torrent/bencode.test.ts
 * @desc Bencode encoder: integers, byte strings (UTF-8 lengths), lists, dicts sorted by raw bytes.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { type Bencodable, bencode } from "@/lib/torrent/bencode";

const text = (value: Bencodable): string => new TextDecoder().decode(bencode(value));

describe("bencode", () => {
  it("encodes integers", () => {
    expect(text(42)).toBe("i42e");
    expect(text(0)).toBe("i0e");
    expect(text(-3)).toBe("i-3e");
  });

  it("rejects numbers that aren't safe integers", () => {
    expect(() => bencode(1.5)).toThrow(/safe integer/);
    expect(() => bencode(Number.NaN)).toThrow(/safe integer/);
    expect(() => bencode(2 ** 53)).toThrow(/safe integer/);
  });

  it("prefixes strings with their UTF-8 byte length", () => {
    expect(text("spam")).toBe("4:spam");
    expect(text("é")).toBe("2:é");
    expect(text("")).toBe("0:");
  });

  it("writes raw bytes unchanged", () => {
    expect([...bencode(new Uint8Array([0, 255]))]).toEqual([50, 58, 0, 255]);
  });

  it("encodes lists", () => {
    expect(text(["a", 1, []])).toBe("l1:ai1elee");
  });

  it("sorts dict keys", () => {
    expect(text({ b: 1, a: { d: "x", c: "y" }, "piece length": 2, pieces: "" })).toBe(
      "d1:ad1:c1:y1:d1:xe1:bi1e12:piece lengthi2e6:pieces0:e",
    );
  });

  it("sorts dict keys by UTF-8 bytes, not UTF-16 units", () => {
    // UTF-16 order would be é, 😀, ｚ; byte order is é (C3), ｚ (EF), 😀 (F0).
    expect(text({ ｚ: 1, "😀": 2, é: 3 })).toBe("d2:éi3e3:ｚi1e4:😀i2ee");
  });

  it("leaves out dict entries whose value is undefined", () => {
    expect(text({ a: 1, b: undefined })).toBe("d1:ai1ee");
  });
});
