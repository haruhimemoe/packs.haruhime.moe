/**
 * @file src/components/layout/Header.tsx
 * @desc Site header: the library SiteHeader with the packs wordmark, the main nav and the
 *       account area.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { SiteHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { AccountNav } from "@/components/layout/AccountNav";
import { NAV_LINKS, SITE } from "@/constants/site";

export function Header() {
  return (
    <SiteHeader
      brand={
        <Link href="/" className="font-extrabold text-c1 text-xl tracking-tight">
          {SITE.name}
          <span className="text-h1">.</span>
        </Link>
      }
      links={NAV_LINKS}
      actions={<AccountNav />}
    />
  );
}
