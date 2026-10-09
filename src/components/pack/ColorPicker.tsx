/**
 * @file src/components/pack/ColorPicker.tsx
 * @desc Palette swatches as a labelled radio group (each swatch named by its color).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Mon Sep 28, 2026
 */

"use client";

import { PALETTE } from "@haruhimemoe/pool";
import { cx } from "@haruhimemoe/ui";
import { useId } from "react";
import { PALETTE_STYLES } from "@/constants/palette";

type ColorPickerProps = {
  legend: string;
  value: number;
  onChange: (color: number) => void;
  disabled?: boolean;
  /** Ring offset matching the background behind the swatches. */
  offsetClass?: "ring-offset-b4" | "ring-offset-b5";
};

/**
 * @function ColorPicker
 * @param props {ColorPickerProps} legend, value, onChange, disabled, offsetClass
 * @returns {JSX.Element} palette swatches as a labelled radio group (each swatch named by its
 *          color)
 */
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
      className="flex flex-wrap items-center coarse:gap-0 gap-1.5"
    >
      {PALETTE.map((color, id) => (
        <label
          key={color}
          title={color}
          className="relative inline-flex coarse:size-11 items-center justify-center"
        >
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
            className={cx(
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
