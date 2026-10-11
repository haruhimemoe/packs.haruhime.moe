/**
 * @file src/components/account/DownloadDataLink.tsx
 * @desc "Download my data": ui's ButtonLink with download, a plain <a download> to GET
 *       /api/me/export (never prefetched or routed).
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { ButtonLink } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";

export const ACCOUNT_EXPORT_PATH = "/api/me/export";

/**
 * @function DownloadDataLink
 * @returns {JSX.Element} "Download my data", a plain download link styled as a secondary button
 */
export function DownloadDataLink() {
  const t = useTranslations("packs.downloadDataLink");
  return (
    <ButtonLink href={ACCOUNT_EXPORT_PATH} download variant="secondary">
      {t("downloadMyData")}
    </ButtonLink>
  );
}
