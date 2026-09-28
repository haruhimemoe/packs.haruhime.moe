/**
 * @file src/components/pack/VisibilityField.tsx
 * @desc Radio group for a saved pack's visibility.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { PACK_VISIBILITIES, type PackVisibility } from "@haruhimemoe/pool/service";
import { RadioGroup } from "@haruhimemoe/ui";
import { VISIBILITY_OPTIONS } from "@/constants/visibility";

type VisibilityFieldProps = {
  value: PackVisibility;
  onChange: (value: PackVisibility) => void;
  disabled?: boolean;
};

const OPTIONS = PACK_VISIBILITIES.map((option) => ({
  value: option,
  label: VISIBILITY_OPTIONS[option].label,
  hint: VISIBILITY_OPTIONS[option].description,
}));

/**
 * @function VisibilityField
 * @param props {VisibilityFieldProps} the chosen visibility, a change handler, and whether it's
 *        locked (while saving)
 * @returns {JSX.Element} a @haruhimemoe/ui RadioGroup, "Who can open it"
 */
export function VisibilityField({ value, onChange, disabled }: VisibilityFieldProps) {
  return (
    <RadioGroup
      label="Who can open it"
      options={OPTIONS}
      value={value}
      onChange={(next) => onChange(next as PackVisibility)}
      disabled={disabled}
    />
  );
}
