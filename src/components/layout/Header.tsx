/**
 * @file src/components/layout/Header.tsx
 * @desc Site header: the library SiteHeader with the packs wordmark, the main nav, the command
 *       palette button, and the account area.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { CommandPaletteButton, SiteHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { AccountNav } from "@/components/layout/AccountNav";
import { navLinks, SITE } from "@/constants/site";

/**
 * @function Header
 * @returns {JSX.Element} site header
 */
export function Header() {
  const t = useTranslations("packs");
  const ui = useTranslations("ui");
  return (
    <SiteHeader
      brand={
        <Link href="/" className="font-extrabold text-c1 text-xl tracking-tight">
          {SITE.name}
          <span className="text-h1">.</span>
        </Link>
      }
      links={navLinks(t)}
      navLabel={ui("shell.mainNav")}
      actions={
        <>
          <CommandPaletteButton label={ui("palette.openLabel")} />
          <AccountNav />
        </>
      }
    />
  );
}
