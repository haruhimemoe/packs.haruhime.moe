/**
 * @file src/components/beatmap/StarRating.tsx
 * @desc Star-rating pill coloured on the osu! difficulty spectrum, with an optional hover title
 *       and an optional label read to screen readers after the stars.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

import { formatStars } from "@haruhimemoe/osu/format";
import { starRatingColor, starRatingTextColor } from "@/utils/star-rating";

export function StarRating({
  value,
  title,
  label,
}: {
  value: number;
  title?: string;
  /** Read after "stars" by screen readers (what `title` tells mouse users). */
  label?: string;
}) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-xs"
      style={{ backgroundColor: starRatingColor(value), color: starRatingTextColor(value) }}
    >
      <span aria-hidden="true">★</span>
      {formatStars(value)}
      <span className="sr-only">stars</span>
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  );
}
