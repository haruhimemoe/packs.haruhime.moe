/**
 * @file src/components/layout/Footer.tsx
 * @desc Site footer: Packs / About / Legal link columns (About links the source on GitHub),
 *       clear local data, one line of fine print (the only place outside the legal pages
 *       that says we never store files), and a row linking the parent brand (haruhime.moe
 *       wordmark) and the haruhimemoe GitHub org.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import Link from "next/link";
import { ClearLocalDataButton } from "@/components/layout/ClearLocalDataButton";
import { API_DOCS_PATH } from "@/constants/api";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";

type FooterLink = { href: string; label: string };

/** The GitHub mark, as haruhime.moe draws it. */
function GitHubMark() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className="size-5">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export const FOOTER_COLUMNS: readonly { title: string; links: readonly FooterLink[] }[] = [
  {
    title: "Packs",
    links: [
      { href: "/new", label: "New pack" },
      { href: "/packs", label: "Public packs" },
      { href: "/k", label: "Open a key" },
      { href: "/guide", label: "Guides" },
    ],
  },
  {
    title: "About",
    links: [
      { href: "/brand", label: "Brand" },
      { href: API_DOCS_PATH, label: "API" },
      { href: SITE.repoUrl, label: "Source on GitHub" },
      { href: `mailto:${SITE.contactEmail}`, label: SITE.contactEmail },
    ],
  },
  {
    title: "Legal",
    links: LEGAL_SLUGS.map((slug) => ({ href: `/legal/${slug}`, label: LEGAL_DOCS[slug].title })),
  },
];

export function Footer() {
  return (
    <footer className="border-b4 border-t bg-b6 text-c3 text-sm">
      <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-3">
          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <p className="mb-3 font-bold text-c4 text-xs uppercase tracking-wide">
                {column.title}
              </p>
              <ul className="flex flex-col gap-2">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="wrap-anywhere transition-colors hover:text-c1"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="flex flex-col gap-3 border-b4 border-t pt-6">
          <ClearLocalDataButton />
          <p className="text-c4 text-xs">
            Beatmap files come from mirror.hinamizawa.ai straight to your browser; this site never
            stores them. {SITE.trademarkNotice}
          </p>
          <div className="flex items-center justify-between gap-4">
            <a
              href={SITE.parentUrl}
              aria-label="haruhime.moe"
              className="opacity-80 transition-opacity hover:opacity-100"
            >
              {/* biome-ignore lint/performance/noImgElement: static SVG wordmark, no optimization needed */}
              <img
                src="/brand/haruhime-wordmark.svg"
                alt="haruhime.moe"
                width={91}
                height={24}
                className="h-6 w-auto"
              />
            </a>
            <a
              href={SITE.githubOrg}
              aria-label="haruhimemoe on GitHub"
              className="text-c3 transition-colors hover:text-c1"
            >
              <GitHubMark />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
