/**
 * @file tests/unit/constants/brand.test.ts
 * @desc Brand swatches match the tokens in globals.css; brand files exist.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ASSETS, BRAND_COLORS } from "@/constants/brand";
import { hslToHex } from "@/utils/color";

const css = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const hue = Number(/--hue:\s*(\d+)/.exec(css)?.[1]);

describe("BRAND_COLORS", () => {
  it.each(BRAND_COLORS.map((c) => [c.token, c] as const))(
    "%s matches globals.css",
    (token, color) => {
      const match = new RegExp(`--color-${token}: hsl\\(var\\(--hue\\) (\\d+)% (\\d+)%\\)`).exec(
        css,
      );
      expect(match).not.toBeNull();
      const [s, l] = [Number(match?.[1]), Number(match?.[2])];
      expect(color.hsl).toEqual([hue, s, l]);
      expect(color.hex).toBe(hslToHex(hue, s, l));
    },
  );
});

describe("BRAND_ASSETS", () => {
  it.each(BRAND_ASSETS.map((a) => [a.href, a] as const))("%s exists in public/", (href) => {
    expect(existsSync(path.join(process.cwd(), "public", href))).toBe(true);
  });
});

describe("brand SVGs", () => {
  it.each(BRAND_ASSETS.map((a) => [a.href] as const))(
    "%s draws its letters as paths, so it looks the same without Nunito installed",
    (href) => {
      expect(readFileSync(path.join(process.cwd(), "public", href), "utf8")).not.toContain("<text");
    },
  );
});
