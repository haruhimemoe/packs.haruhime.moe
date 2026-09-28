/**
 * @file src/components/pack/VisibilityField.tsx
 * @desc Radio group for a saved pack's visibility.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { PACK_VISIBILITIES, type PackVisibility } from "@haruhimemoe/pool/service";
import { useId } from "react";
import { VISIBILITY_OPTIONS } from "@/constants/visibility";

type VisibilityFieldProps = {
  value: PackVisibility;
  onChange: (value: PackVisibility) => void;
  disabled?: boolean;
};

export function VisibilityField({ value, onChange, disabled }: VisibilityFieldProps) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="mb-1 font-bold text-c3 text-sm">Who can open it</legend>
      {PACK_VISIBILITIES.map((option) => (
        <label key={option} className="flex items-start gap-2 text-sm">
          <input
            type="radio"
            name={name}
            value={option}
            checked={value === option}
            onChange={() => onChange(option)}
            className="mt-1 accent-h1"
          />
          <span>
            <span className="font-bold text-c1">{VISIBILITY_OPTIONS[option].label}</span>
            <span className="text-c3"> · {VISIBILITY_OPTIONS[option].description}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
