/**
 * @file src/components/layout/ClearLocalDataButton.tsx
 * @desc Footer control: deletes this browser's saved draft and downloaded maps after an inline
 *       confirm (@haruhimemoe/ui's InlineConfirm), then says whether it worked.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { InlineConfirm } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { clearLocalData } from "@/lib/storage/local-data";

type Result = "done" | "error" | null;

/**
 * @function ClearLocalDataButton
 * @param props {{ clear?: () => Promise<void> }} what clearing does (a test seam)
 * @returns {JSX.Element} the Clear local data confirm and its result
 */
export function ClearLocalDataButton({ clear = clearLocalData }: { clear?: () => Promise<void> }) {
  const t = useTranslations("packs.footer");
  const ui = useTranslations("ui");
  const [result, setResult] = useState<Result>(null);

  const run = async () => {
    setResult(null);
    try {
      await clear();
      setResult("done");
    } catch {
      setResult("error");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <InlineConfirm
        trigger={t("clear")}
        triggerProps={{ variant: "ghost", className: "-ml-3 h-7 px-3 text-xs" }}
        question={t("clearQuestion")}
        confirmLabel={t("delete")}
        pendingLabel={t("deleting")}
        cancelLabel={ui("actions.cancel")}
        confirmVariant="danger"
        onConfirm={run}
      />
      <output>
        {result === "done" ? t("cleared") : result === "error" ? t("clearFailed") : ""}
      </output>
    </div>
  );
}
