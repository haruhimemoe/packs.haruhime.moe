/**
 * @file src/components/layout/AppPalette.tsx
 * @desc The site's command palette, mounted once in the root layout so Ctrl K (Cmd K) works from
 *       anywhere; CommandPaletteButton in the header opens it too. Commands: siteCommands' page
 *       nav (from NAV_LINKS), tools, GitHub, and Sign in when signed out; New pack, Paste pack
 *       key, and My packs (signed-in only); and a provider over public packs by name or owner.
 *       signedIn comes from the app's existing client-side session read (useAccount, asked once
 *       per page load), the same source AccountNav uses, so the root layout stays static.
 *       Sign out runs signOut (src/lib/account.ts): POST /api/signout ends the haruhime.moe
 *       session and clears its shared cookies, then the page refreshes in place.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Sun Oct 11, 2026
 */

"use client";

import { uiLabels } from "@haruhimemoe/next-kit/i18n";
import { type Command, CommandPalette, siteCommands } from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { navLinks, SITE } from "@/constants/site";
import { signOut, useAccount } from "@/lib/account";
import { createPacksProvider } from "@/lib/palette-packs";

/** Packs-specific commands beyond siteCommands' defaults. */
type T = ReturnType<typeof useTranslations>;

const extras = (t: T, ui: ReturnType<typeof uiLabels>, signedIn: boolean): Command[] => [
  {
    id: "packs.new",
    title: t("palette.new"),
    subtitle: t("palette.newSub"),
    group: t("palette.packs"),
    keywords: ["create", "build"],
    run: (ctx) => ctx.navigate("/new"),
  },
  {
    id: "packs.paste-key",
    title: t("palette.pasteKey"),
    subtitle: t("palette.pasteKeySub"),
    group: t("palette.packs"),
    keywords: ["open", "share"],
    run: (ctx) => ctx.navigate("/k"),
  },
  {
    id: "packs.my-packs",
    title: t("palette.myPacks"),
    subtitle: t("palette.myPacksSub"),
    group: ui.siteCommands.account,
    when: () => signedIn,
    run: (ctx) => ctx.navigate("/me"),
  },
  {
    id: "packs.sign-out",
    title: ui.account.signOut,
    group: ui.siteCommands.account,
    when: () => signedIn,
    run: async () => {
      await signOut();
    },
  },
];

/**
 * @function AppPalette
 * @returns {JSX.Element} the mounted command palette
 */
export function AppPalette() {
  const t = useTranslations("packs");
  const tUi = useTranslations("ui");
  const ui = useMemo(() => uiLabels(tUi), [tUi]);
  const account = useAccount();
  const signedIn = account.status === "signed-in";

  const commands = useMemo<Command[]>(
    () => [
      ...siteCommands({
        pages: navLinks(t),
        tools: "packs",
        repo: SITE.repoUrl,
        account: { signedIn, signInHref: "/signin" },
        labels: ui.siteCommands,
      }),
      ...extras(t, ui, signedIn),
    ],
    [signedIn, t, ui],
  );

  const providers = useMemo(() => [createPacksProvider()], []);

  return (
    <CommandPalette
      storageKey="packs"
      commands={commands}
      providers={providers}
      labels={ui.palette}
      placeholder={ui.paletteProps.placeholder}
      label={ui.paletteProps.label}
    />
  );
}
