/**
 * @file src/components/packs/PublicPackCard.tsx
 * @desc One public pack in the /packs grid: name, host, size, description excerpt, last update.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import Image from "next/image";
import Link from "next/link";
import type { PublicPackCard as PublicPack } from "@/schemas/public-pack";
import { formatShortDate } from "@/utils/date";

export function PublicPackCard({ pack }: { pack: PublicPack }) {
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
        <span aria-hidden="true">·</span>
        <span>
          {pack.slotCount} {pack.slotCount === 1 ? "map" : "maps"}
        </span>
      </p>
      {pack.excerpt ? (
        <p className="wrap-anywhere line-clamp-2 text-c2 text-sm">{pack.excerpt}</p>
      ) : null}
      <p className="mt-auto text-c4 text-xs">Updated {formatShortDate(pack.updatedAt)}</p>
    </li>
  );
}
