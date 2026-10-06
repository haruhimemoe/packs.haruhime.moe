/**
 * @file src/constants/legal-site.ts
 * @desc packs' `LegalSite` config: the facts next-kit's legal blocks (LegalContact, DataWeKeep,
 *       Processors, YourRights, DmcaNotice, NoWarranty, Changes) render from. Mirrors what
 *       content/legal/privacy.mdx and copyright.mdx already say in prose; this doesn't add any
 *       store, processor or cookie the app doesn't really have.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Mon Oct 5, 2026
 */

import type { LegalSite } from "@haruhimemoe/next-kit/legal";
import { SITE } from "@/constants/site";

export const LEGAL_SITE: LegalSite = {
  siteName: SITE.title,
  operator: "haruhime.moe",
  contactEmail: SITE.contactEmail,
  effectiveDate: "2026-10-05",
  stores: [
    {
      what: "Your osu! account link (user ID, username, avatar URL and country)",
      why: "Your account, and knowing which packs are yours",
    },
    {
      what: "Sign-in sessions (the IP address and browser User-Agent you signed in from)",
      why: "Keeping you signed in, and spotting misuse of your account",
    },
    {
      what: "Packs you save (name, description, beatmap IDs, slot layout, visibility and magnet links)",
      why: "The service you asked for",
    },
    {
      what: "Every saved version of a pack, with who saved it and when",
      why: "Letting you see and keep a pack's history",
    },
    {
      what: "Your API key, if you create one (a hash of it, its first 12 characters, and its dates)",
      why: "Letting your scripts and bots use the packs API",
    },
    {
      what: "Short-lived rate-limit counters, by account or IP address",
      why: "Protecting the service from abuse",
    },
  ],
  processors: [
    {
      name: "Vercel",
      purpose: "hosts the website and runs its server functions.",
      link: "https://vercel.com",
    },
    {
      name: "MongoDB Atlas",
      purpose: "stores the account and pack data listed above.",
      link: "https://www.mongodb.com/atlas",
    },
    {
      name: "osu! (ppy Pty Ltd)",
      purpose: "handles sign-in and answers lookups for maps the mirror doesn't have.",
      link: "https://osu.ppy.sh",
    },
  ],
  cookies: [
    "The session cookie (HttpOnly, keeps you signed in; set only when you sign in)",
    "packs-signed-in (tells the page to check whether you're signed in; holds no personal data)",
    "A sign-in cookie (connects osu!'s reply to your browser while you sign in; deleted within 5 minutes)",
  ],
  hosting:
    "packs doesn't host files. What you can save is pack metadata, a name, description, beatmap IDs and links, never a beatmap file.",
};
