/**
 * @file src/components/pack/ArchiveBadge.tsx
 * @desc The "Archived pool" badge of an archive pack, linking its pool at the first source in a
 *       new tab and naming the source. On /packs cards and on the pack's own page.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { ARCHIVE_SOURCE_LABELS } from "@/constants/archive";
import type { ArchiveSourceLink } from "@/schemas/archive";

export function ArchiveBadge({ source }: { source: ArchiveSourceLink }) {
  return (
    <a
      href={source.url}
      target="_blank"
      rel="noopener noreferrer"
      className="self-start rounded-full bg-b3 px-2.5 py-0.5 font-bold text-c2 text-xs transition-colors hover:text-h1"
    >
      Archived pool <span aria-hidden="true">·</span> <span className="sr-only">from</span>{" "}
      {ARCHIVE_SOURCE_LABELS[source.kind]}
    </a>
  );
}
