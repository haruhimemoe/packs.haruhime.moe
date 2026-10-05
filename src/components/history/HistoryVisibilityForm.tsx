/**
 * @file src/components/history/HistoryVisibilityForm.tsx
 * @desc The owner's toggle for who can see a pack's history. Saves on change and rolls the
 *       control back on failure, reporting through a live notice.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { Notice, SegmentedControl } from "@haruhimemoe/ui";
import { useState } from "react";
import { HISTORY_COPY } from "@/constants/history";
import { PacksApiError, packsApi } from "@/lib/packs-api";

type Visibility = "private" | "public";

type HistoryVisibilityFormProps = {
  slug: string;
  historyPublic: boolean;
  api?: Pick<typeof packsApi, "setHistoryPublic">;
};

const OPTIONS: { value: Visibility; label: string }[] = [
  { value: "private", label: "Only me" },
  { value: "public", label: "Anyone who can see the pack" },
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
      setError(cause instanceof PacksApiError ? cause.message : "Something went wrong. Try again.");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        label={HISTORY_COPY.publicLabel}
        options={OPTIONS}
        value={value}
        onChange={(next) => void change(next)}
      />
      <Notice live tone="error">
        {error ?? ""}
      </Notice>
    </div>
  );
}
