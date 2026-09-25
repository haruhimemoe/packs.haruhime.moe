/**
 * @file src/components/layout/Footer.tsx
 * @desc Site footer: the library SiteFooter with the Packs / About / Legal link columns (About
 *       links the source on GitHub), clear local data, one line of fine print (the only place
 *       outside the legal pages that says we never store files), and the row linking the
 *       parent brand (haruhime.moe wordmark), our Discord server and the haruhimemoe GitHub org.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Fri Sep 25, 2026
 */

import { SiteFooter, type SiteFooterColumn } from "@haruhimemoe/ui";
import { ClearLocalDataButton } from "@/components/layout/ClearLocalDataButton";
import { API_DOCS_PATH } from "@/constants/api";
import { LEGAL_DOCS, LEGAL_SLUGS } from "@/constants/legal";
import { SITE } from "@/constants/site";

export const FOOTER_COLUMNS: readonly SiteFooterColumn[] = [
  {
    title: "Packs",
    items: [
      { href: "/new", label: "New pack" },
      { href: "/packs", label: "Public packs" },
      { href: "/k", label: "Open a key" },
      { href: "/guide", label: "Guides" },
    ],
  },
  {
    title: "About",
    items: [
      { href: "/brand", label: "Brand" },
      { href: API_DOCS_PATH, label: "API" },
      { href: SITE.repoUrl, label: "Source on GitHub" },
      { href: `mailto:${SITE.contactEmail}`, label: SITE.contactEmail },
    ],
  },
  {
    title: "Legal",
    items: LEGAL_SLUGS.map((slug) => ({ href: `/legal/${slug}`, label: LEGAL_DOCS[slug].title })),
  },
];

export function Footer() {
  return (
    <SiteFooter
      columns={FOOTER_COLUMNS}
      extra={<ClearLocalDataButton />}
      finePrint={
        <>
          Beatmap files come from mirror.hinamizawa.ai straight to your browser; this site never
          stores them. {SITE.trademarkNotice}
        </>
      }
      parentHref={SITE.parentUrl}
      discordHref={SITE.discordUrl}
      githubHref={SITE.githubOrg}
    />
  );
}
