/**
 * @file src/components/collection/LazerCollection.tsx
 * @desc The osu!lazer side of "Add to osu! collection": the collection's name as it shows in lazer
 *       (used exactly as typed; empty refused, outer spaces warned about in a note the field
 *       points at with aria-describedby), then a zip holding a collection.db with just this
 *       pack's maps and an empty osu!.import.cfg, for the setup wizard's import from a previous
 *       osu! install, with the steps. Desktop only. A name the zip can't hold (a lone surrogate)
 *       is the field's own error as it's typed, with the package's code; any failure to build the
 *       zip shows its code in a separate alert. Long names wrap anywhere, and the preview clips
 *       them like the osu!stable side.
 * @author David @dvhsh (https://dvh.sh)
 * @created Fri Sep 25, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { CollectionDbError } from "@haruhimemoe/osu/collections";
import { Button, Notice, TextInput } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useId, useState } from "react";
import { lazerCollectionZip } from "@/lib/collections/collection-files";
import { collectionLabel, defaultCollectionName, lazerZipName } from "@/utils/osu-collection";
import { countOf } from "@/utils/text";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

export type LazerCollectionProps = {
  /** The pack's name, for the default collection name and the zip's name. */
  packName: string;
  /** The pack's MD5s, or null while the map info isn't ready. */
  hashes: readonly string[] | null;
  /** Saves a file from the click (the card passes downloadBlob). */
  download: (blob: Blob, filename: string) => void;
};

// lazer takes a tab or a line break in a name, so the only name the zip refuses is one UTF-8
// can't encode: a lone surrogate, usually half of an emoji. The field checks for that as the
// player types, with the package's code.
const BROKEN_NAME = (t: T) => t("thatNameHasA");

// Any code from here on is about building the zip, never the name or a file the player picked
// (that's the osu!stable side), so it gets its own sentence.
const zipErrorText = (t: T, error: unknown): string => {
  if (!(error instanceof CollectionDbError)) return t("couldnTSaveThe");
  return t("couldnTBuildThe", { code: error.code });
};

/**
 * @function LazerCollection
 * @param props {LazerCollectionProps} packName, hashes, download
 * @returns {JSX.Element} the osu!lazer side of "Add to osu! collection"
 */
export function LazerCollection({ packName, hashes, download }: LazerCollectionProps) {
  const t = useTranslations("packs.lazerCollection");
  const id = useId();
  const [typedName, setTypedName] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Exactly as typed: lazer matches names exactly, so "Farm " and "Farm" are two collections.
  const name = typedName ?? defaultCollectionName(packName);
  const empty = name.trim() === "";
  const padded = !empty && name !== name.trim();
  const nameError = empty ? t("typeACollectionName") : name.isWellFormed() ? null : BROKEN_NAME(t);
  const count = hashes?.length ?? 0;
  const zipName = lazerZipName(packName);
  const paddedId = `${id}-padded`;

  const onDownload = () => {
    if (hashes === null || hashes.length === 0 || nameError !== null) return;
    try {
      download(lazerCollectionZip(name, hashes), zipName);
    } catch (caught) {
      setError(zipErrorText(t, caught));
      setStatus("");
      return;
    }
    setError(null);
    setStatus(t("downloadedZipnameFollowThe", { zipName }));
  };

  return (
    <div className="flex flex-col gap-4">
      <TextInput
        id={`${id}-name`}
        label={t("collectionNameInOsu")}
        value={name}
        hint={t("typeItExactlyAs")}
        error={nameError ?? undefined}
        aria-describedby={padded ? paddedId : undefined}
        onChange={(event) => {
          setTypedName(event.currentTarget.value);
          setStatus("");
          setError(null);
        }}
      />
      {padded ? (
        <Notice id={paddedId} tone="warning">
          {t("thisNameStartsOr")}
        </Notice>
      ) : null}
      {count > 0 && nameError === null ? (
        <p className="wrap-anywhere text-c2 text-sm">
          {t("addsMapToName", { map: countOf(count, "map"), name: collectionLabel(name) })}
        </p>
      ) : null}
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-bold text-c1">{t("thenInOsuLazer")}</p>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-c2">
          <li>{t("extractTheZipYou")}</li>
          <li>{t("openSettingsThenGeneral")}</li>
          <li>{t("chooseTheExtractedFolder")}</li>
          <li>{t("untickBeatmapsScoresAnd")}</li>
          <li>{t("waitUntilLazerSays")}</li>
        </ol>
        <p className="text-c3">{t("thisWorksOnDesktop")}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button onClick={onDownload} disabled={count === 0 || nameError !== null}>
          {t("downloadZipForOsu")}
        </Button>
      </div>
      <Notice live className="wrap-anywhere">
        {status}
      </Notice>
      {error ? (
        <Notice live tone="error">
          {error}
        </Notice>
      ) : null}
    </div>
  );
}
