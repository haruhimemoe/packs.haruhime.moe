/**
 * @file src/components/packs/PublicPackCard.tsx
 * @desc One public pack in the /packs grid: name, host, size, star and length ranges (once the
 *       pack's stats are in), description excerpt, last update.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import Image from "next/image";
import Link from "next/link";
import type { PublicPackCard as PublicPack } from "@/schemas/public-pack";
import { formatShortDate } from "@/utils/date";
import { formatDuration, formatRange, formatStars } from "@/utils/format";

const DOT = <span aria-hidden="true">·</span>;

export function PublicPackCard({ pack }: { pack: PublicPack }) {
  const stars = pack.stats?.r;
  const length = pack.stats?.l;
  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-[10px] bg-b4 p-4">
      <Link
        href={`/p/${pack.slug}`}
        className="wrap-anywhere font-bold text-c1 text-lg transition-colors hover:text-h1"
      >
        {pack.name}
      </Link>
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-c3 text-sm">
        {pack.ownerAvatarUrl ? (
          <Image src={pack.ownerAvatarUrl} alt="" width={20} height={20} className="rounded-full" />
        ) : null}
        <span>{pack.ownerName}</span>
        {DOT}
        <span>
          {pack.slotCount} {pack.slotCount === 1 ? "map" : "maps"}
        </span>
        {stars ? (
          <>
            {DOT}
            <span className="tabular-nums">
              <span aria-hidden="true">★</span> {formatRange(stars[0], stars[1], formatStars)}
              <span className="sr-only"> stars</span>
            </span>
          </>
        ) : null}
        {length ? (
          <>
            {DOT}
            <span className="tabular-nums">
              <span className="sr-only">Length </span>
              {formatRange(length[0], length[1], formatDuration)}
            </span>
          </>
        ) : null}
      </p>
      {pack.excerpt ? (
        <p className="wrap-anywhere line-clamp-2 text-c2 text-sm">{pack.excerpt}</p>
      ) : null}
      <p className="mt-auto text-c4 text-xs">Updated {formatShortDate(pack.updatedAt)}</p>
    </li>
  );
}
