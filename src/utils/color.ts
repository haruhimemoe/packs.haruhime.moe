/**
 * @file src/utils/color.ts
 * @desc HSL to hex, matching how browsers resolve hsl() colors (for the brand page swatches).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

/**
 * @function hslToHex
 * @param h {number} hue in degrees
 * @param s {number} saturation, 0 to 100
 * @param l {number} lightness, 0 to 100
 * @returns {string} "#rrggbb"
 */
export const hslToHex = (h: number, s: number, l: number): string => {
  const sat = s / 100;
  const light = l / 100;
  const a = sat * Math.min(light, 1 - light);
  const channel = (n: number): string => {
    const k = (n + h / 30) % 12;
    const value = light - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(value * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${channel(0)}${channel(8)}${channel(4)}`;
};
