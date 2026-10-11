/**
 * @file src/components/account/ApiKeyReveal.tsx
 * @desc A new API key, shown once, on @haruhimemoe/ui's CopyField, and "I've saved it", which
 *       hides it for good.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Sep 28, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { Button, CopyField } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import type { Ref } from "react";

type ApiKeyRevealProps = {
  /** The whole key, which the server never shows again. */
  apiKey: string;
  onSaved: () => void;
  /** The key field, which the card focuses when the key appears. */
  inputRef?: Ref<HTMLInputElement>;
};

/**
 * @function ApiKeyReveal
 * @param props {ApiKeyRevealProps} the key, what "I've saved it" does, and the field's ref
 * @returns {JSX.Element} the warning, the key field, Copy and I've saved it
 */
export function ApiKeyReveal({ apiKey, onSaved, inputRef }: ApiKeyRevealProps) {
  const t = useTranslations("packs.apiKeyReveal");
  return (
    <>
      <p className="font-bold text-c1 text-sm">{t("copyYourKeyNow")}</p>
      <CopyField
        ref={inputRef}
        label={t("yourNewApiKey")}
        value={apiKey}
        copiedMessage={t("keyCopied")}
        failedMessage={t("couldnTCopySelect")}
      />
      <Button variant="ghost" onClick={onSaved}>
        {t("iVeSavedIt")}
      </Button>
    </>
  );
}
