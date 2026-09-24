/**
 * @file tests/unit/constants/brand.test.ts
 * @desc Brand swatches match the palette the site ships (the @haruhimemoe/ui theme at the hue
 *       globals.css sets); brand files exist.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BRAND_ASSETS, BRAND_COLORS } from "@/constants/brand";
import { hslToHex } from "@/utils/color";

const globals = readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const theme = readFileSync(
  createRequire(import.meta.url).resolve("@haruhimemoe/ui/theme.css"),
  "utf8",
);
const hue = Number(/--hue:\s*(\d+)/.exec(globals)?.[1]);

/** A token's lightness: fixed in the theme, or a variable with a default globals.css may set. */
const lightness = (fixed: string | undefined, variable: string | undefined, fallback: string) => {
  if (fixed !== undefined) return Number(fixed);
  const override = new RegExp(`--${variable}:\\s*(\\d+)%`).exec(globals);
  return Number(override?.[1] ?? fallback);
};

describe("BRAND_COLORS", () => {
  it("reads the hue from globals.css", () => {
    expect(hue).toBe(333);
  });

  it.each(BRAND_COLORS.map((c) => [c.token, c] as const))(
    "%s matches the theme",
    (token, color) => {
      const match = new RegExp(
        `--color-${token}: hsl\\(var\\(--hue\\) (\\d+)% (?:(\\d+)%|var\\(--(${token}-l), (\\d+)%\\))\\)`,
      ).exec(theme);
      expect(match).not.toBeNull();
      const s = Number(match?.[1]);
      const l = lightness(match?.[2], match?.[3], match?.[4] ?? "");
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
