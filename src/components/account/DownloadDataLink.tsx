/**
 * @file src/components/account/DownloadDataLink.tsx
 * @desc "Download my data": a plain <a download> to GET /api/me/export, styled as a button. Not
 *       next/link: it's a file from an API route, never a page to prefetch or route to.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { buttonClasses } from "@/components/ui/buttonStyles";

export const ACCOUNT_EXPORT_PATH = "/api/me/export";

export function DownloadDataLink() {
  return (
    <a
      href={ACCOUNT_EXPORT_PATH}
      download
      className={buttonClasses({ variant: "secondary", className: "self-start" })}
    >
      Download my data
    </a>
  );
}
