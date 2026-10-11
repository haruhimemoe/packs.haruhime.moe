/**
 * @file src/components/pack/PackNotFound.tsx
 * @desc 404 body for /p/[slug] and its edit page. Never says which of deleted / private / never
 *       existed applies, so private slugs aren't confirmed.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { ButtonLink, PageHeader } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";

/**
 * @function PackNotFound
 * @returns {JSX.Element} 404 body for /p/[slug] and its edit page
 */
export function PackNotFound() {
  const t = useTranslations("packs.packNotFound");
  return (
    <PageHeader
      title={t("packNotFound")}
      lead={t("thisPackMayHave")}
      actions={
        <>
          <ButtonLink href="/">{t("openAPackKey")}</ButtonLink>
          <ButtonLink href="/new" variant="secondary">
            {t("buildAPack")}
          </ButtonLink>
        </>
      }
    />
  );
}
