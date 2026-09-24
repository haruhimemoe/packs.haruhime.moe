/**
 * @file src/components/pack/ColorPicker.tsx
 * @desc Palette swatches as a labelled radio group (each swatch named by its color).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { PALETTE } from "@haruhimemoe/pool";
import { useId } from "react";
import { PALETTE_STYLES } from "@/constants/palette";
import { cn } from "@/utils/cn";

type ColorPickerProps = {
  legend: string;
  value: number;
  onChange: (color: number) => void;
  disabled?: boolean;
  /** Ring offset matching the background behind the swatches. */
  offsetClass?: "ring-offset-b4" | "ring-offset-b5";
};

export function ColorPicker({
  legend,
  value,
  onChange,
  disabled = false,
  offsetClass = "ring-offset-b4",
}: ColorPickerProps) {
  const name = useId();
  return (
    <fieldset
      disabled={disabled}
      aria-label={legend}
      className="flex flex-wrap items-center gap-1.5"
    >
      {PALETTE.map((color, id) => (
        <label key={color} title={color} className="relative inline-flex">
          <input
            type="radio"
            name={name}
            value={id}
            checked={value === id}
            onChange={() => onChange(id)}
            aria-label={color}
            className="peer sr-only"
          />
          <span
            aria-hidden="true"
            className={cn(
              "size-5 rounded-full ring-2 ring-transparent ring-offset-2 peer-checked:ring-c1 peer-focus-visible:ring-h1",
              offsetClass,
              PALETTE_STYLES[id],
            )}
          />
        </label>
      ))}
    </fieldset>
  );
}
