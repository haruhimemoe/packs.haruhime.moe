/**
 * @file src/components/history/HistoryVisibilityForm.tsx
 * @desc The owner's toggle for who can see a pack's history. Saves on change and rolls the
 *       control back on failure, reporting through a live notice.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { Notice, SegmentedControl } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { HISTORY_COPY } from "@/constants/history";
import { PacksApiError, packsApi } from "@/lib/packs-api";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

type Visibility = "private" | "public";

type HistoryVisibilityFormProps = {
  slug: string;
  historyPublic: boolean;
  api?: Pick<typeof packsApi, "setHistoryPublic">;
};

const OPTIONS = (t: T): { value: Visibility; label: string }[] => [
  { value: "private", label: t("onlyMe") },
  { value: "public", label: t("anyoneWhoCanSee") },
];

/**
 * @function HistoryVisibilityForm
 * @param props {HistoryVisibilityFormProps} slug, historyPublic, api
 * @returns {JSX.Element} the segmented control, saving on change
 */
export function HistoryVisibilityForm({
  slug,
  historyPublic,
  api = packsApi,
}: HistoryVisibilityFormProps) {
  const t = useTranslations("packs.historyVisibilityForm");
  const [value, setValue] = useState<Visibility>(historyPublic ? "public" : "private");
  const [error, setError] = useState<string | null>(null);

  const change = async (next: Visibility) => {
    const previous = value;
    setValue(next);
    setError(null);
    try {
      await api.setHistoryPublic(slug, next === "public");
    } catch (cause) {
      setValue(previous);
      setError(cause instanceof PacksApiError ? cause.message : t("somethingWentWrongTry"));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label={HISTORY_COPY.publicLabel}
        options={OPTIONS(t)}
        value={value}
        onChange={(next) => void change(next)}
      />
      <Notice live tone="error">
        {error ?? ""}
      </Notice>
    </div>
  );
}
