/**
 * @file src/constants/legal-site.ts
 * @desc packs' `LegalSite` config: the facts next-kit's legal blocks (LegalContact, DataWeKeep,
 *       Processors, YourRights, DmcaNotice, NoWarranty, Changes) render from. Mirrors what
 *       content/legal/privacy.mdx and copyright.mdx already say in prose; this doesn't add any
 *       store, processor or cookie the app doesn't really have.
 * @author David @dvhsh (https://dvh.sh)
 * @created Mon Oct 5, 2026
 * @modified Tue Oct 6, 2026
 */

import type { LegalSite } from "@haruhimemoe/next-kit/legal";
import { SITE } from "@/constants/site";

export const LEGAL_SITE: LegalSite = {
  siteName: SITE.title,
  operator: "haruhime.moe",
  contactEmail: SITE.contactEmail,
  effectiveDate: "2026-10-06",
  stores: [
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
      what: "Short-lived rate-limit counters, by account, osu! user ID or IP address",
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
      purpose: "stores the pack data listed above.",
      link: "https://www.mongodb.com/atlas",
    },
    {
      name: "haruhime.moe",
      purpose: "runs sign-in and keeps the account and sessions packs reads to know who you are.",
      link: "https://www.haruhime.moe",
    },
    {
      name: "osu! (ppy Pty Ltd)",
      purpose:
        "confirms sign-in for haruhime.moe and answers lookups for maps the mirror doesn't have.",
      link: "https://osu.ppy.sh",
    },
  ],
  cookies: [
    "haruhime.moe's session cookie (on .haruhime.moe, HttpOnly, keeps you signed in; packs only reads it)",
    "haruhime-signed-in (set by haruhime.moe; tells the page to check whether you're signed in; holds no personal data)",
  ],
  hosting:
    "packs doesn't host files. What you can save is pack metadata, a name, description, beatmap IDs and links, never a beatmap file.",
};
