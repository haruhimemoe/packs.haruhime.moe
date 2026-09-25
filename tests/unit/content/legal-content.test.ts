/**
 * @file tests/unit/content/legal-content.test.ts
 * @desc Guards legal copy: every registered doc has an MDX file, no duplicate h1, the clauses
 *       that cover us stay in the text, every call our server makes to osu! and the mirror (pack
 *       stats included) is disclosed, and no page describes the Google Drive or OneDrive exports
 *       that were never built (a magnet link is the only export a pack records). The haruhime
 *       pools account's packs are tournament pools from pools.haruhime.moe, which gets them from
 *       hosts, community submissions and sources like otdb, not from otdb alone.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Fri Sep 25, 2026
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { RATE_LIMITS } from "@/constants/api";
import { LEGAL_DOCS, LEGAL_SLUGS, type LegalSlug } from "@/constants/legal";
import { SERVER_USER_AGENT, SITE } from "@/constants/site";
import { OSU_API_BUDGET_PER_IP } from "@/constants/star-ratings";

const file = (slug: LegalSlug) => path.join(process.cwd(), "content", "legal", `${slug}.mdx`);
const read = (slug: LegalSlug) => readFileSync(file(slug), "utf8");

describe.each(LEGAL_SLUGS)("content/legal/%s.mdx", (slug) => {
  it("exists", () => {
    expect(existsSync(file(slug))).toBe(true);
  });

  it("has no h1 of its own (the page renders the title)", () => {
    expect(read(slug)).not.toMatch(/^# /m);
  });

  it("lists the contact email", () => {
    expect(read(slug)).toContain(SITE.contactEmail);
  });

  it("names no sponsor (Evergreen Cup moved to haruhime.moe)", () => {
    expect(read(slug)).not.toMatch(/sponsor|Evergreen/i);
  });

  it("describes no Google Drive or OneDrive export and no Google OAuth scope", () => {
    expect(read(slug)).not.toMatch(/Google Drive|OneDrive|\bDrive\b|drive\.file|Microsoft/);
  });
});

describe("terms", () => {
  const text = () => read("terms");

  it.each([
    "We do not host",
    "solely responsible",
    "copyrighted",
    "indemnify",
    "as is",
    "ppy Pty Ltd",
    "not affiliated",
    "osu! is a trademark of ppy Pty Ltd",
    "hinamizawa",
    "California",
  ])("contains %j", (phrase) => {
    expect(text()).toContain(phrase);
  });
});

describe("torrent copy", () => {
  it.each([
    ["terms", "### Magnet links"],
    ["terms", "Pack owners are responsible for the magnet links they add"],
    ["terms", "We don't host or seed the files a torrent points to"],
    ["terms", "aren't responsible for what a torrent contains or for anyone's use of it"],
    [
      "terms",
      "We may remove magnet links, or packs, that are reported to us or that break these terms",
    ],
    ["disclaimers", "## Torrents"],
    ["disclaimers", "Torrents are peer-to-peer"],
    ["disclaimers", "packs doesn't host, seed, or track any files"],
    ["disclaimers", "The magnet links on packs are added by pack owners"],
    ["disclaimers", "we can't check what their torrents contain"],
    ["disclaimers", "You're responsible for what you download and share"],
    ["disclaimers", "following the law where you live"],
    ["disclaimers", "isn't legal for you, don't do it"],
  ] as const)("%s says %j", (slug, phrase) => {
    expect(read(slug)).toContain(phrase);
  });
});

describe("privacy", () => {
  const text = () => read("privacy");

  it.each(["MongoDB Atlas", "Vercel", "request logs", "assets.ppy.sh", "a.ppy.sh"])(
    "contains %j",
    (phrase) => {
      expect(text()).toContain(phrase);
    },
  );

  it("has a comma after the mirror in the third-party list", () => {
    expect(text()).toContain(
      "the beatmap mirror (mirror.hinamizawa.ai), cover images from osu!'s CDN (assets.ppy.sh), and player avatars",
    );
  });

  it("tells signed-out visitors that an API call without a valid key keeps their IP briefly", () => {
    const paragraph = text()
      .split("\n")
      .find((line) => line.startsWith("If you don't sign in"));
    expect(paragraph).toContain(
      "If you send a request to the API without a valid key, we keep your IP address in a short-lived counter (about 2 minutes) to stop key guessing.",
    );
  });

  it.each([
    "## Your IP address",
    "`/api/osu/star-ratings`",
    "`/api/osu/beatmaps`",
    "signed in or not",
    "so one visitor can't use up the site's osu! API quota",
    "deleted automatically within about two minutes",
    "in server memory only",
    "never written to the database",
    "gone when the server instance restarts",
    "/64 network",
    "Our server never forwards your IP address to osu!: the osu! API sees only our server.",
  ])("discloses every IP use: %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it.each([
    "any osu! calls it makes for that count against your IP address's share too",
    "It asks the beatmap mirror (mirror.hinamizawa.ai) for the maps' details",
    "our server never downloads beatmap files",
    'the "Clear local data" button at the bottom of every page',
  ])("discloses the pack stats lookups and the local data button: %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("says saving packs on the website creates account counters too", () => {
    expect(text()).toContain(
      "If you save or change packs (magnet links included), use the API, or create a key: short-lived request counters, by account",
    );
  });

  it.each([
    "we keep only the torrent's fingerprint, name, size, and our own tracker list",
    "Magnet links on a pack page were added by the pack's owner",
    "your torrent app contacts the trackers listed in it and other peers, and they see your IP address",
    "packs lists only its own set of public trackers in these links",
  ])("describes what opening a magnet link shares: %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("says the tab remembers the place in filtered public packs, and for how long", () => {
    expect(text()).toContain(
      "When you filter public packs, this tab's session storage remembers how many results were showing and how far down you'd scrolled, so the Back button takes you there again. It's gone when you close the tab.",
    );
  });

  it("names the linked osu! account record among what we store", () => {
    expect(text()).toContain("a record linking your account to osu! (never your osu! tokens)");
  });

  it("keeps the failed-key IP counter out of the signed-in list", () => {
    expect(text()).not.toContain("by IP address for failed key attempts");
  });

  it("makes no absolute claim that nothing is stored for signed-out visitors", () => {
    expect(text()).not.toContain("we store nothing about you");
  });

  it.each([
    "[Your rights under GDPR and CCPA](/legal/your-privacy-rights)",
    "## Cookies",
    "packs-signed-in",
    "HttpOnly",
    "no tracking or advertising cookies",
    "IP address and browser User-Agent",
    "Only beatmap IDs are sent",
    "mod names",
    "Download my data",
    "how long we keep it",
    "download options",
  ])("covers %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("no longer mentions map usage, here or on the rights page", () => {
    expect(text()).not.toMatch(/map usage/i);
    expect(read("your-privacy-rights")).not.toMatch(/map usage/i);
  });
});

describe("your-privacy-rights", () => {
  const text = () => read("your-privacy-rights");

  it.each([
    "controller",
    "GDPR",
    "CCPA",
    "Contract",
    "legitimate interest",
    "IP address and browser User-Agent",
    "Vercel",
    "supervisory authority",
    "portability",
    "Download my data",
    "Delete account",
    "within 30 days",
    "within 45 days",
    "We don't sell or share personal information",
    "Global Privacy Control",
    "Sensitive personal information",
    "may fall below",
    "/legal/privacy",
  ])("contains %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("writes its table as JSX, since our MDX has no GFM tables", () => {
    expect(text()).toContain("<table>");
    expect(text()).not.toMatch(/^\|/m);
  });
});

describe("copyright", () => {
  it.each(["We do not host", "DMCA", "https://mirror.hinamizawa.ai/docs/content-takedowns"])(
    "contains %j",
    (phrase) => {
      expect(read("copyright")).toContain(phrase);
    },
  );

  it.each([
    "## Sources",
    "Packs owned by haruhime pools are osu! tournament mappools published from [pools.haruhime.moe](https://pools.haruhime.moe), which credits each pool's sources",
    "the tournament's hosts",
    "a community submission",
    "such as [otdb](https://otdb.sheppsu.me) by Sheppsu",
  ])("credits where tournament pools come from: %j", (phrase) => {
    expect(read("copyright")).toContain(phrase);
  });

  it("doesn't call every pools pack a past pool", () => {
    expect(read("copyright")).not.toMatch(/past (osu! )?tournament/i);
  });

  it("no longer describes archive packs or links the retired guide", () => {
    expect(read("copyright")).not.toMatch(/archive pack|archived pool|\/guide\/archived-pools/i);
  });

  it("dates the Sources section", () => {
    expect(LEGAL_DOCS.copyright.lastUpdated).toBe("2026-09-25");
    expect(LEGAL_DOCS["your-privacy-rights"].lastUpdated).toBe("2026-09-24");
  });
});

describe("public packs and moderation copy", () => {
  it.each([
    ["terms", "We may hide or delete public or unlisted packs that break these terms"],
    ["terms", "We never review private packs"],
    ["terms", "we may pin public packs to the top of the public packs page or unpin them"],
    [
      "terms",
      "including tournament pools published from pools.haruhime.moe, which can have mistakes",
    ],
    ["privacy", "the pack name, description,"],
    ["privacy", "listed on the public packs page with your osu! username and avatar"],
    ["copyright", "a pack name and description"],
  ] as const)("%s says %j", (slug, phrase) => {
    expect(read(slug)).toContain(phrase);
  });
});

describe("API copy", () => {
  it.each([
    ["terms", "## API"],
    ["terms", "Keys are personal"],
    ["terms", "rate limits"],
    ["terms", "We may revoke any key"],
    ["terms", "/docs/api"],
    ["privacy", "API key"],
    ["privacy", "SHA-256"],
    ["privacy", "never the key itself"],
    ["privacy", "rate limits"],
    ["privacy", "linked osu! account record, API key"],
  ] as const)("%s says %j", (slug, phrase) => {
    expect(read(slug)).toContain(phrase);
  });

  it.each(["api key", "rate-limit counters"])("the rights page lists %j", (phrase) => {
    expect(read("your-privacy-rights").toLowerCase()).toContain(phrase);
  });

  it("the rights page says deletion covers the key", () => {
    expect(read("your-privacy-rights")).toContain(
      "deletes your account, your sessions, your API key, and every pack you saved",
    );
  });

  it("the rights page says saving packs creates account counters too", () => {
    expect(read("your-privacy-rights")).toContain(
      "Rate-limit counters, if you save or change packs, use the API, or create a key",
    );
  });

  it("the rights page lists the linked osu! account record in the export", () => {
    expect(read("your-privacy-rights")).toContain(
      "your profile details, your linked osu! account record, your sessions",
    );
  });

  it("the rights page says who gets an IP counter", () => {
    expect(read("your-privacy-rights")).toContain(
      "keyed by your account, or by your IP address when a request to the API has no valid key",
    );
  });

  it.each([
    "Rate-limit counters for osu! lookups",
    "Sign-in rate-limit counts",
    "server memory only",
    "/64 network",
    "Our server never forwards your IP address to osu!",
  ])("the rights page lists every IP use: %j", (phrase) => {
    expect(read("your-privacy-rights")).toContain(phrase);
  });

  it("the rights page counts the stats lookups among the osu! lookups", () => {
    expect(read("your-privacy-rights")).toContain(
      "and the lookups for a pack's stats when you save it), keyed by your IP address",
    );
  });

  it("discloses the pools service's failed-token counter", () => {
    expect(read("privacy")).toContain("**Requests to our pools service without its token.**");
    expect(read("your-privacy-rights")).toContain(
      "or a request to our pools service has no valid token",
    );
  });

  it("never says that counter stops token guessing: the right token always gets through", () => {
    // src/lib/machine-auth.ts compares the token before it counts, so the counter only turns a
    // 401 into a 429. The token's randomness is what stops guessing.
    expect(read("privacy")).not.toMatch(/token guessing/i);
    expect(read("privacy")).toContain("an address that keeps failing is told to slow down");
  });

  it("the per-IP counters' windows match the two-minute lifetime the pages state", () => {
    // A counter expires one minute after its window ends (src/lib/rate-limit.ts,
    // src/lib/osu/attributes.ts), so a 60-second window is gone within about two minutes.
    for (const rule of [
      RATE_LIMITS.osuStarRatings,
      RATE_LIMITS.osuBeatmaps,
      RATE_LIMITS.authFail,
      RATE_LIMITS.serviceAuthFail,
      OSU_API_BUDGET_PER_IP,
    ]) {
      expect(rule.windowSeconds).toBe(60);
    }
  });

  it("the rights page keeps the key-creation counter's real lifetime", () => {
    expect(read("your-privacy-rights")).toContain(
      "About 2 minutes, or about an hour for the key-creation counter",
    );
  });
});

describe("disclaimers", () => {
  const text = () => read("disclaimers");

  it.each([
    "not affiliated",
    "Tournament Committee",
    "hinamizawa",
    "Anthropic",
    "A person reviews, tests, and ships every change",
    "/legal/copyright",
    "Origin",
    "Referer",
  ])("contains %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("says our server asks the mirror for map details, and never for files", () => {
    expect(text()).toContain(
      "To work out a saved pack's stats, our server asks the mirror for the maps' details (never the beatmap files), with the same User-Agent.",
    );
    expect(text()).not.toContain("Our server never contacts the mirror");
  });

  it.each(["**Pack stats.**"])("says what our other numbers mean: %j", (phrase) => {
    expect(text()).toContain(phrase);
  });

  it("no longer mentions the importer or archived pools", () => {
    expect(text()).not.toMatch(/otdb|archived pool|importer/i);
  });

  it("keeps the verbatim ppy trademark notice", () => {
    expect(text()).toContain(SITE.trademarkNotice);
  });

  it("quotes the exact User-Agent our server sends", () => {
    expect(text()).toContain(`User-Agent: ${SERVER_USER_AGENT}`);
  });

  it("pins the exact star-rating disclaimer and not the old version", () => {
    expect(text()).toContain(
      "Where packs shows a star rating with mods, it comes from the osu! API and is kept for up to 30 days, so it can lag behind a difficulty update on osu!.",
    );
    expect(text()).not.toContain("your browser calculates");
  });
});
