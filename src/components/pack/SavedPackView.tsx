/**
 * @file src/components/pack/SavedPackView.tsx
 * @desc /p/[slug]: the Download card at the top (the recorded magnet links first, then the
 *       mirror, and the retry when map info fails), the saved pool with live metadata and star ratings with mods, and sharing. The
 *       owner also sees its visibility, an Edit link, and can add or remove magnet links; an admin
 *       can remove a magnet link from a public or unlisted pack, and pin a public pack that isn't
 *       hidden to the top of /packs (or unpin it).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import { encodePackKey } from "@haruhimemoe/pool";
import { ButtonLink, Card, PageHeader } from "@haruhimemoe/ui";
import { useId, useMemo, useState } from "react";
import { ExportPanel } from "@/components/export/ExportPanel";
import type { MagnetTarget } from "@/components/export/TorrentExport";
import { HiddenNotice } from "@/components/pack/HiddenNotice";
import { MagnetLinks } from "@/components/pack/MagnetLinks";
import { PackKeyField } from "@/components/pack/PackKeyField";
import { PackStats } from "@/components/pack/PackStats";
import { type PinApi, PinButton } from "@/components/pack/PinButton";
import { PoolTable } from "@/components/pack/PoolTable";
import { ShortLinkField } from "@/components/pack/ShortLinkField";
import { VISIBILITY_OPTIONS } from "@/constants/visibility";
import { useBeatmapMeta } from "@/hooks/useBeatmapMeta";
import { usePoolStarRatings } from "@/hooks/useModdedStarRatings";
import { usePackAccess } from "@/hooks/usePackAccess";
import { packsApi } from "@/lib/packs-api";
import type { Pool } from "@/schemas/pack";
import type { PackExport } from "@/schemas/pack-export";
import type { SavedPack } from "@/schemas/saved-pack";
import { infohashOf } from "@/utils/magnet";
import { isPinnable } from "@/utils/pins";

export type PackViewApi = PinApi & {
  get: (
    slug: string,
  ) => Promise<{ pack: SavedPack; isOwner: boolean; isAdmin?: boolean; pinned?: boolean } | null>;
  addMagnet: (slug: string, url: string, packKey: string) => Promise<PackExport[]>;
  removeMagnet: (slug: string, url: string) => Promise<PackExport[]>;
  adminRemoveMagnet: (slug: string, url: string) => Promise<PackExport[]>;
};

export function SavedPackView({
  pack,
  isOwner: isOwnerProp,
  isAdmin: isAdminProp,
  pinned: pinnedProp,
  api = packsApi,
  readCookie,
}: {
  pack: SavedPack;
  /** Known already (not-found fallback, tests). Omitted: asked in the browser when signed in. */
  isOwner?: boolean;
  /** Known with isOwner. Omitted: asked in the browser along with ownership. */
  isAdmin?: boolean;
  /** Admins only, known with isAdmin: whether the pack is pinned to the top of /packs. */
  pinned?: boolean;
  /** Test seams. Defaults: our API, document.cookie. */
  api?: PackViewApi;
  readCookie?: () => string;
}) {
  const access = usePackAccess(isOwnerProp === undefined ? pack.slug : null, {
    get: api.get,
    ...(readCookie ? { readCookie } : {}),
  });
  const isOwner = isOwnerProp ?? (access.status === "found" && access.isOwner);
  const isAdmin = isAdminProp ?? (access.status === "found" && access.isAdmin);
  const pinned = pinnedProp ?? (access.status === "found" && access.pinned);
  // The cached page can be older than the pack: pin rules go by what the viewer check found.
  const current = access.status === "found" ? access.pack : pack;
  const canPin =
    isAdmin &&
    (pinned || isPinnable({ visibility: current.visibility, hidden: Boolean(current.hiddenAt) }));
  const ref = useMemo<Pool>(
    () =>
      pack.buckets
        ? { name: pack.name, slots: pack.slots, buckets: pack.buckets }
        : { name: pack.name, slots: pack.slots },
    [pack],
  );
  const packKey = useMemo(() => encodePackKey(ref), [ref]);
  const ids = useMemo(() => ref.slots.map((s) => s.beatmapId), [ref]);
  const meta = useBeatmapMeta(ids);
  const stars = usePoolStarRatings(ref, meta.get);
  const count = `${pack.slots.length} ${pack.slots.length === 1 ? "map" : "maps"}`;
  const [exports, setExports] = useState<readonly PackExport[]>(pack.exports ?? []);
  const magnets = useMemo<MagnetTarget | undefined>(
    () =>
      isOwner
        ? {
            added: exports.map((entry) => entry.url),
            add: async (url) => setExports(await api.addMagnet(pack.slug, url, packKey)),
          }
        : undefined,
    [isOwner, exports, api, pack.slug, packKey],
  );
  // Admins moderate public and unlisted packs only; the server enforces it too.
  const removeMagnet = isOwner
    ? async (url: string) => setExports(await api.removeMagnet(pack.slug, url))
    : isAdmin && pack.visibility !== "private"
      ? async (url: string) => setExports(await api.adminRemoveMagnet(pack.slug, url))
      : undefined;
  const hasMagnets = exports.some((entry) => infohashOf(entry.url) !== null);
  const mapsHeadingId = useId();

  return (
    <div className="flex flex-col gap-6">
      {pack.hiddenAt ? <HiddenNotice /> : null}
      <PageHeader
        title={pack.name}
        meta={isOwner ? `${count} · ${VISIBILITY_OPTIONS[pack.visibility].label}` : count}
        actions={isOwner ? <ButtonLink href={`/p/${pack.slug}/edit`}>Edit</ButtonLink> : undefined}
      />
      {canPin ? <PinButton slug={pack.slug} pinned={pinned} api={api} /> : null}
      {pack.description ? (
        <p className="wrap-anywhere max-w-3xl whitespace-pre-line text-c2">{pack.description}</p>
      ) : null}
      <ExportPanel
        pack={ref}
        packKey={packKey}
        getMeta={meta.get}
        onRetryMeta={meta.retry}
        magnets={magnets}
        torrentLinks={
          hasMagnets ? <MagnetLinks exports={exports} onRemove={removeMagnet} /> : undefined
        }
      />
      <section aria-labelledby={mapsHeadingId} className="flex flex-col gap-6">
        <h2 id={mapsHeadingId} className="sr-only">
          Maps
        </h2>
        <PackStats slots={ref.slots} getState={meta.get} starsOf={stars.starsOf} />
        <PoolTable
          slots={ref.slots}
          buckets={ref.buckets}
          getState={meta.get}
          modsBySlot={stars.modsBySlot}
          ratings={stars.ratings}
        />
      </section>
      <Card title="Share">
        <div className="flex flex-col gap-5">
          {isOwner && pack.visibility === "private" ? (
            <p className="text-c3 text-sm">
              This pack is private. Only you can open the short link; the pack key works for anyone.
            </p>
          ) : null}
          <ShortLinkField slug={pack.slug} />
          <PackKeyField packKey={packKey} />
        </div>
      </Card>
    </div>
  );
}
