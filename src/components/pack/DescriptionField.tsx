/**
 * @file src/components/pack/DescriptionField.tsx
 * @desc Saved pack description textarea with a live character count.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { MAX_DESCRIPTION_LENGTH } from "@haruhimemoe/pool/service";
import { Textarea } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useId } from "react";

type DescriptionFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

/**
 * @function DescriptionField
 * @param props {DescriptionFieldProps} value, onChange, disabled
 * @returns {JSX.Element} saved pack description textarea with a live character count
 */
export function DescriptionField({ value, onChange, disabled }: DescriptionFieldProps) {
  const t = useTranslations("packs.descriptionField");
  const inputId = useId();
  const countId = useId();
  return (
    <div className="flex flex-col gap-1">
      <Textarea
        id={inputId}
        label={t("descriptionOptional")}
        value={value}
        rows={4}
        maxLength={MAX_DESCRIPTION_LENGTH}
        disabled={disabled}
        placeholder={t("whatThePackIs")}
        aria-describedby={countId}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={countId} className="self-end text-c4 text-xs">
        {value.length}/{MAX_DESCRIPTION_LENGTH}
      </p>
    </div>
  );
}
