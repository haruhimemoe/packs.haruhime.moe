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
 * @modified Tue Oct 6, 2026
 */

"use client";

import { type Command, CommandPalette, siteCommands } from "@haruhimemoe/ui";
import { useMemo } from "react";
import { NAV_LINKS, SITE } from "@/constants/site";
import { signOut, useAccount } from "@/lib/account";
import { createPacksProvider } from "@/lib/palette-packs";

/** Packs-specific commands beyond siteCommands' defaults. */
const extras = (signedIn: boolean): Command[] => [
  {
    id: "packs.new",
    title: "New pack",
    subtitle: "Build a pack from beatmap IDs or links",
    group: "Packs",
    keywords: ["create", "build"],
    run: (ctx) => ctx.navigate("/new"),
  },
  {
    id: "packs.paste-key",
    title: "Paste pack key",
    subtitle: "Open a pack someone shared with you",
    group: "Packs",
    keywords: ["open", "share"],
    run: (ctx) => ctx.navigate("/k"),
  },
  {
    id: "packs.my-packs",
    title: "My packs",
    subtitle: "Your saved packs, API key and packs data",
    group: "Account",
    when: () => signedIn,
    run: (ctx) => ctx.navigate("/me"),
  },
  {
    id: "packs.sign-out",
    title: "Sign out",
    group: "Account",
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
  const account = useAccount();
  const signedIn = account.status === "signed-in";

  const commands = useMemo<Command[]>(
    () => [
      ...siteCommands({
        pages: NAV_LINKS,
        tools: "packs",
        repo: SITE.repoUrl,
        account: { signedIn, signInHref: "/signin" },
      }),
      ...extras(signedIn),
    ],
    [signedIn],
  );

  const providers = useMemo(() => [createPacksProvider()], []);

  return <CommandPalette storageKey="packs" commands={commands} providers={providers} />;
}
