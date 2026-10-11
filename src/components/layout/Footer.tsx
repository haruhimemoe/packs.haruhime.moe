/**
 * @file src/components/layout/Footer.tsx
 * @desc Site footer: the library SiteFooter with the Packs / About / Legal link columns (About
 *       links the source on GitHub), ui's "haruhime tools" column (pools, bb, All tools), clear local data, one line of fine print (the only place
 *       outside the legal pages that says we never store files), and the row linking the
 *       parent brand (haruhime.moe wordmark), our Discord server and the haruhimemoe GitHub org.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { LOCALES } from "@haruhimemoe/messages";
import { LocaleSelect, SiteFooter, type SiteFooterColumn } from "@haruhimemoe/ui";
import { useLocale, useTranslations } from "next-intl";
import { ClearLocalDataButton } from "@/components/layout/ClearLocalDataButton";
import { API_DOCS_PATH } from "@/constants/api";
import { CONTENT } from "@/constants/content";
import { SITE } from "@/constants/site";

/** A translator: next-intl's t for "packs" or "common". */
type T = (key: string) => string;

/**
 * @function footerColumns
 * @param t {T} the "packs" translator
 * @param common {T} the "common" translator
 * @returns {SiteFooterColumn[]} Packs, About and Legal (legal page titles stay English, like
 *          the pages)
 */
export const footerColumns = (t: T, common: T): SiteFooterColumn[] => [
  {
    title: t("nav.packs"),
    items: [
      { href: "/new", label: t("nav.newPack") },
      { href: "/packs", label: t("nav.publicPacks") },
      { href: "/k", label: t("nav.openKey") },
      { href: "/guides", label: t("nav.guides") },
    ],
  },
  {
    title: common("footer.about"),
    items: [
      { href: "/brand", label: common("footer.brand") },
      { href: API_DOCS_PATH, label: t("nav.api") },
      { href: SITE.repoUrl, label: common("footer.source") },
      { href: `mailto:${SITE.contactEmail}`, label: SITE.contactEmail },
    ],
  },
  {
    title: common("footer.legal"),
    items: CONTENT.entries.legal.map(({ slug, title }) => ({
      href: `/legal/${slug}`,
      label: title,
    })),
  },
];

/**
 * @function Footer
 * @returns {JSX.Element} ui's SiteFooter with the columns, the local data button, the language
 *          picker, the Discord and GitHub links and the fine print, in the page's language
 */
export function Footer() {
  const t = useTranslations("packs");
  const common = useTranslations("common");
  const ui = useTranslations("ui");
  const locale = useLocale();
  return (
    <SiteFooter
      columns={footerColumns(t, common)}
      navLabel={ui("shell.footerNav")}
      tools={{ current: "packs", title: ui("shell.tools"), allLabel: ui("shell.allTools") }}
      extra={
        <div className="flex flex-col gap-2">
          <ClearLocalDataButton />
          <LocaleSelect
            locales={LOCALES}
            value={locale}
            label={ui("shell.language")}
            cookieDomain=".haruhime.moe"
          />
        </div>
      }
      finePrint={t("footer.finePrint")}
      parentHref={SITE.parentUrl}
      discordHref={SITE.discordUrl}
      githubHref={SITE.githubOrg}
    />
  );
}
