/**
 * @file src/constants/palette.ts
 * @desc Custom bucket colors: the classes for the 10 palette colors, indexed like
 *       @haruhimemoe/pool's PALETTE (whose index is the stored color id). Built-in buckets and
 *       no-slot maps take their colors from @haruhimemoe/ui's ModBadge. Class names are written
 *       out in full so Tailwind finds them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 4, 2026
 */

import { PALETTE, type PALETTE_SIZE } from "@haruhimemoe/pool";

/** Background class per palette color id: PALETTE_STYLES[id] styles PALETTE[id]. Append only. */
export const PALETTE_STYLES = [
  "bg-green-400",
  "bg-teal-300",
  "bg-pink-400",
  "bg-lime-300",
  "bg-cyan-300",
  "bg-fuchsia-400",
  "bg-yellow-300",
  "bg-red-400",
  "bg-indigo-300",
  "bg-stone-300",
] as const satisfies readonly string[] & { length: typeof PALETTE_SIZE };

/**
 * @function paletteColor
 * @param id {number} a stored custom bucket color id (an index into PALETTE)
 * @returns {Lowercase<(typeof PALETTE)[number]>} its ModBadge color name; green (id 0) when the
 *          id is outside the palette, as PALETTE_STYLES falls back today
 */
export const paletteColor = (id: number): Lowercase<(typeof PALETTE)[number]> =>
  (PALETTE[id] ?? PALETTE[0]).toLowerCase() as Lowercase<(typeof PALETTE)[number]>;
