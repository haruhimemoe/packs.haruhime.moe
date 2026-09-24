/**
 * @file src/components/layout/ClearLocalDataButton.tsx
 * @desc Footer control that deletes this browser's draft and downloaded maps, after a confirm.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

"use client";

import { useState } from "react";
import { clearLocalData } from "@/lib/storage/local-data";

type Phase = "idle" | "confirm" | "clearing" | "done" | "error";

const LINK = "font-bold underline-offset-2 transition-colors hover:text-c1 hover:underline";

export function ClearLocalDataButton({ clear = clearLocalData }: { clear?: () => Promise<void> }) {
  const [phase, setPhase] = useState<Phase>("idle");

  const run = () => {
    setPhase("clearing");
    clear().then(
      () => setPhase("done"),
      () => setPhase("error"),
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {phase === "confirm" ? (
        <>
          <span>Delete your saved draft and downloaded maps from this browser?</span>
          <button type="button" onClick={run} className={LINK}>
            Delete
          </button>
          <button type="button" onClick={() => setPhase("idle")} className={LINK}>
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setPhase("confirm")}
          disabled={phase === "clearing"}
          className={LINK}
        >
          Clear local data
        </button>
      )}
      <output>
        {phase === "done"
          ? "Local data cleared."
          : phase === "error"
            ? "Couldn't clear everything. Clear this site's data in your browser settings."
            : ""}
      </output>
    </div>
  );
}
