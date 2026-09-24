/**
 * @file src/constants/palette.ts
 * @desc Badge colors: the fixed built-in bucket colors, the classes for the 10 custom bucket colors
 *       (indexed like @haruhimemoe/pool's PALETTE, whose index is the stored color id), and the
 *       no-slot badge. Class names are written out in full so Tailwind finds them.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import type { ModBucket, PALETTE_SIZE } from "@haruhimemoe/pool";

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

export const BUILT_IN_BADGE: Record<ModBucket, string> = {
  NM: "bg-sky-400",
  HD: "bg-amber-300",
  HR: "bg-rose-400",
  DT: "bg-violet-400",
  FM: "bg-emerald-400",
  TB: "bg-orange-400",
};

/** No slot: no color, just a quiet grey pill. */
export const NO_SLOT_BADGE = "bg-b3 text-c2";
