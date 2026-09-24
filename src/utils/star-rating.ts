/**
 * @file src/utils/star-rating.ts
 * @desc osu! star-rating colour spectrum. Stops match osu! (lazer) difficulty colours; values are
 *       data, reimplemented here (no osu! source copied).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

const STOPS: readonly (readonly [number, string])[] = [
  [0.1, "#4290fb"],
  [1.25, "#4fc0ff"],
  [2, "#4fffd5"],
  [2.5, "#7cff4f"],
  [3.3, "#f6f05c"],
  [4.2, "#ff8068"],
  [4.9, "#ff4e6f"],
  [5.8, "#c645b8"],
  [6.7, "#6563de"],
  [7.7, "#18158e"],
  [9, "#000000"],
];

const channel = (hex: string, at: number) => Number.parseInt(hex.slice(at, at + 2), 16);
const toHex = (value: number) => Math.round(value).toString(16).padStart(2, "0");

/**
 * @function starRatingColor
 * @param stars {number} star rating
 * @returns {string} "#rrggbb"; grey below 0.1, black from 9 up, linear RGB blend between stops
 */
export const starRatingColor = (stars: number): string => {
  if (stars < 0.1) return "#aaaaaa";
  const upper = STOPS.findIndex(([at]) => stars < at);
  const lower = STOPS[upper - 1];
  const high = STOPS[upper];
  if (upper === -1 || !lower || !high) return "#000000";
  const t = (stars - lower[0]) / (high[0] - lower[0]);
  return `#${[1, 3, 5]
    .map((at) => toHex(channel(lower[1], at) + (channel(high[1], at) - channel(lower[1], at)) * t))
    .join("")}`;
};

/**
 * @function starRatingTextColor
 * @param stars {number} star rating
 * @returns {string} readable text colour on top of starRatingColor(stars)
 */
export const starRatingTextColor = (stars: number): string => (stars < 6.5 ? "#000000" : "#ffd966");
