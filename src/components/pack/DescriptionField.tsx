/**
 * @file src/components/pack/DescriptionField.tsx
 * @desc Saved pack description textarea with a live character count.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

"use client";

import { fieldClasses } from "@haruhimemoe/ui";
import { useId } from "react";
import { MAX_DESCRIPTION_LENGTH } from "@/constants/pack";

type DescriptionFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function DescriptionField({ value, onChange, disabled }: DescriptionFieldProps) {
  const inputId = useId();
  const countId = useId();
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="font-bold text-c3 text-sm">
        Description (optional)
      </label>
      <textarea
        id={inputId}
        value={value}
        rows={4}
        maxLength={MAX_DESCRIPTION_LENGTH}
        disabled={disabled}
        placeholder="What the pack is for: the tournament, the round, anything players should know."
        aria-describedby={countId}
        onChange={(event) => onChange(event.target.value)}
        className={fieldClasses("min-h-24 resize-y")}
      />
      <p id={countId} className="self-end text-c4 text-xs">
        {value.length}/{MAX_DESCRIPTION_LENGTH}
      </p>
    </div>
  );
}
