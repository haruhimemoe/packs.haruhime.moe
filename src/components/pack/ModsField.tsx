/**
 * @file src/components/pack/ModsField.tsx
 * @desc A custom slot's mods: No mods, Forced (six toggle chips; the other half of
 *       EZ+HR or DT+HT and a fourth mod are blocked, but stay focusable, with the reason as a
 *       title for mouse users and an aria-describedby'd description for screen readers), or
 *       Freemod.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Thu Sep 24, 2026
 */

"use client";

import {
  MOD_ACRONYMS,
  MOD_SET_MESSAGES,
  type ModAcronym,
  modBlockedReason,
  NO_MODS,
  type SlotMods,
  toggleMod,
} from "@haruhimemoe/pool";
import { Fragment, useId, useState } from "react";
import { cn } from "@/utils/cn";

type ModsFieldProps = {
  code: string;
  value: SlotMods;
  disabled?: boolean;
  onChange: (mods: SlotMods) => void;
};

const CHOICES = [
  { kind: "none", label: "No mods" },
  { kind: "forced", label: "Forced" },
  { kind: "free", label: "Freemod" },
] as const;

/**
 * @function ModsField
 * @param props {ModsFieldProps} the slot's code, its current mods, and a change handler
 * @returns {JSX.Element} a labelled radio group (No mods / Forced / Freemod) with the six mod
 *          chips shown while Forced is selected
 */
export function ModsField({ code, value, disabled = false, onChange }: ModsFieldProps) {
  // "Forced" with nothing picked isn't a valid setting, so it lives here until a chip is pressed.
  const [pickingForced, setPickingForced] = useState(false);
  const name = useId();
  const descId = useId();
  const kind = value.kind === "none" && pickingForced ? "forced" : value.kind;
  const set: readonly ModAcronym[] = value.kind === "forced" ? value.set : [];

  const choose = (next: SlotMods["kind"]) => {
    setPickingForced(next === "forced");
    if (next === "free") onChange({ kind: "free" });
    else if (next === "none" || value.kind === "free") onChange(NO_MODS);
  };

  const toggle = (mod: ModAcronym) => {
    const next = toggleMod(set, mod);
    // Unpicking the last mod saves "no mods" but keeps the chips open.
    if (next.length === 0) setPickingForced(true);
    onChange(next.length === 0 ? NO_MODS : { kind: "forced", set: next });
  };

  return (
    // aria-label, as ColorPicker does: an sr-only " for EZ" span loses its leading space in the
    // accessible name ("Modsfor EZ").
    <fieldset disabled={disabled} aria-label={`Mods for ${code}`} className="flex flex-col gap-2">
      <legend className="mb-1 font-bold text-c3 text-sm">Mods</legend>
      <div className="flex flex-wrap gap-3">
        {CHOICES.map((choice) => (
          <label key={choice.kind} className="flex items-center gap-1.5 text-c2 text-sm">
            <input
              type="radio"
              name={name}
              checked={kind === choice.kind}
              onChange={() => choose(choice.kind)}
            />
            {choice.label}
          </label>
        ))}
      </div>
      {kind === "forced" ? (
        <div className="flex flex-wrap items-center gap-1">
          {MOD_ACRONYMS.map((mod) => {
            const picked = set.includes(mod);
            const reason = modBlockedReason(set, mod);
            const blocked = reason !== null;
            const chipDescId = `${descId}-${mod}`;
            return (
              <Fragment key={mod}>
                <button
                  type="button"
                  aria-pressed={picked}
                  aria-disabled={blocked || undefined}
                  aria-describedby={blocked ? chipDescId : undefined}
                  title={reason ?? undefined}
                  onClick={() => {
                    if (blocked) return;
                    toggle(mod);
                  }}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 font-bold text-xs transition-colors",
                    blocked ? "cursor-not-allowed opacity-40" : "",
                    picked ? "bg-h1 text-b6" : "bg-b3 text-c2 hover:bg-b2",
                  )}
                >
                  {mod}
                </button>
                {/* Outside the button (not inside): a nested description would leak into the
                    button's own accessible name. Blocked chips stay focusable (aria-disabled, not
                    disabled), so title alone isn't reliable for screen readers either. */}
                {blocked ? (
                  <span id={chipDescId} className="sr-only">
                    {reason}
                  </span>
                ) : null}
              </Fragment>
            );
          })}
          {set.length === 0 ? (
            <span className="text-c4 text-xs">{MOD_SET_MESSAGES.empty}</span>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
