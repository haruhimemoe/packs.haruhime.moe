/**
 * @file src/components/layout/ClearLocalDataButton.tsx
 * @desc Footer control: deletes this browser's saved draft and downloaded maps after an inline
 *       confirm (@haruhimemoe/ui's InlineConfirm), then says whether it worked.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Oct 5, 2026
 */

"use client";

import { InlineConfirm } from "@haruhimemoe/ui";
import { useState } from "react";
import { clearLocalData } from "@/lib/storage/local-data";

type Result = "done" | "error" | null;

/**
 * @function ClearLocalDataButton
 * @param props {{ clear?: () => Promise<void> }} what clearing does (a test seam)
 * @returns {JSX.Element} the Clear local data confirm and its result
 */
export function ClearLocalDataButton({ clear = clearLocalData }: { clear?: () => Promise<void> }) {
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
        trigger="Clear local data"
        triggerProps={{ variant: "ghost", className: "-ml-3 h-7 px-3 text-xs" }}
        question="Delete your saved draft and downloaded maps from this browser?"
        confirmLabel="Delete"
        pendingLabel="Deleting…"
        confirmVariant="danger"
        onConfirm={run}
      />
      <output>
        {result === "done"
          ? "Local data cleared."
          : result === "error"
            ? "Couldn't clear everything. Clear this site's data in your browser settings."
            : ""}
      </output>
    </div>
  );
}
