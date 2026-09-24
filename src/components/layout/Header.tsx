/**
 * @file src/components/layout/Header.tsx
 * @desc Site header: wordmark + main nav + account area, osu!-web dark bar.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import Link from "next/link";
import { AccountNav } from "@/components/layout/AccountNav";
import { NAV_LINKS, SITE } from "@/constants/site";

export function Header() {
  return (
    <header className="border-b4 border-b bg-b6">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-8 gap-y-2 px-4 py-3">
        <Link href="/" className="font-extrabold text-c1 text-xl tracking-tight">
          {SITE.name}
          <span className="text-h1">.</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-5 gap-y-1 font-bold text-sm">
            {NAV_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className="text-c3 transition-colors hover:text-c1">
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="ml-auto">
          <AccountNav />
        </div>
      </div>
    </header>
  );
}
