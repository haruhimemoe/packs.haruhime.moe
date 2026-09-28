/**
 * @file src/components/pack/ModsField.tsx
 * @desc A custom slot's mods: No mods, Forced (six toggle chips; the other half of
 *       EZ+HR or DT+HT and a fourth mod are blocked, but stay focusable, with the reason as a
 *       title for mouse users and an aria-describedby'd description for screen readers), or
 *       Freemod.
 * @author David @dvhsh (https://dvh.sh)
 * @created Wed Sep 23, 2026
 * @modified Mon Sep 28, 2026
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
import { Chip, RadioGroup } from "@haruhimemoe/ui";
import { useState } from "react";

type ModsFieldProps = {
  code: string;
  value: SlotMods;
  disabled?: boolean;
  onChange: (mods: SlotMods) => void;
};

const CHOICES = [
  { value: "none", label: "No mods" },
  { value: "forced", label: "Forced" },
  { value: "free", label: "Freemod" },
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
      <RadioGroup
        label="Mods"
        options={CHOICES}
        value={kind}
        onChange={(next) => choose(next as SlotMods["kind"])}
        className="flex-row flex-wrap gap-x-3"
      />
      {kind === "forced" ? (
        <div className="flex flex-wrap items-center gap-1">
          {MOD_ACRONYMS.map((mod) => (
            <Chip
              key={mod}
              pressed={set.includes(mod)}
              onPressedChange={() => toggle(mod)}
              unavailableReason={modBlockedReason(set, mod) ?? undefined}
            >
              {mod}
            </Chip>
          ))}
          {set.length === 0 ? (
            <span className="text-c4 text-xs">{MOD_SET_MESSAGES.empty}</span>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}
