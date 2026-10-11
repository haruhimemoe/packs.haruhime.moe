/**
 * @file src/components/home/HomeScreen.tsx
 * @desc Homepage body: hero, pack key box, what it does, recent public packs, FAQ, the other
 *       haruhime tools, and the structured data (Organization, WebSite with the /packs search,
 *       WebApplication, FAQPage) as one JSON-LD graph.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Sun Oct 11, 2026
 */

import { HARUHIME_ORG, ld, SEARCH_TERM } from "@haruhimemoe/next-kit/seo";
import {
  ButtonLink,
  Card,
  JsonLd,
  PageHeader,
  SectionHeading,
  Text,
  TextLink,
} from "@haruhimemoe/ui";
import { useTranslations } from "next-intl";
import { KeyPasteForm } from "@/components/pack/KeyPasteForm";
import { PublicPackList } from "@/components/packs/PublicPackList";
import { BB_URL, POOLS_URL, SEO_SITE } from "@/constants/seo";
import type { PublicPackCard } from "@/schemas/public-pack";

/** A translator: next-intl's t for this file's catalog keys. */
type T = (key: string, values?: Record<string, string | number>) => string;

const FEATURES = (t: T) =>
  [
    {
      title: "Build",
      body: t("pasteIdsLinksOr"),
    },
    {
      title: "Share",
      body: t("everyPackHasA"),
    },
    {
      title: "Download",
      body: t("getTheWholePool"),
    },
  ] as const;

export const HOME_FAQ = [
  {
    question: "Is it free?",
    answer:
      "Yes. No account is needed to build, open, or download a pack. Signing in with osu! lets you save packs and get short links.",
  },
  {
    question: "Where do the beatmaps come from?",
    answer: "Your browser downloads them straight from the mirror.hinamizawa.ai beatmap mirror.",
  },
  {
    question: "What's a pack key?",
    answer:
      "A short piece of text that holds the whole pool. Anyone who pastes it here gets the same pack back.",
  },
  {
    question: "Can I make my pack public?",
    answer: "Yes. Save it, set it to Public, and it's listed on the public packs page.",
  },
  {
    question: "How do the public pack filters match?",
    answer:
      "A pack matches when its star rating, length or BPM range overlaps the range you set, when it has every mod and mode you tick, and when its map count is in range. While a star rating, length, BPM, mod or mode filter is set, packs whose stats aren't ready yet are hidden, and the list says how many.",
  },
  {
    question: "How can I sort public packs?",
    answer:
      "By newest (the default), recently updated, star rating low to high or high to low, most maps, or name. Pinned packs sit above the list until you search, filter or sort.",
  },
  {
    question: "How do I copy a map's ID for !mp map?",
    answer:
      "Press Copy ID on the map's row, on any pack page or in the builder. It copies the beatmap ID.",
  },
  {
    question: "Can I share a pack as a torrent?",
    answer:
      "Yes. Download the maps, press Make torrent in the Download card, and seed it with a torrent app like qBittorrent. The torrent file is built in your browser, and you do the seeding.",
  },
  {
    question: "Can I add a pack to my osu! collections?",
    answer:
      "Yes. Use \"Add to osu! collection\" on the pack's page. On osu!stable, close osu!, load your collection.db and download it back with the maps added, then put it in your osu! folder in place of the old one before you start osu!. On osu!lazer, download a zip and import it with lazer's setup wizard. Your collection.db is read in your browser and isn't uploaded.",
  },
] as const;

/** What the WebApplication node lists as its features. */
const APP_FEATURES = [
  "Build a pack from beatmap IDs, links or a pasted mappool",
  "Download a whole pool as one zip, built in the browser",
  "Make a torrent of a pack and share its magnet link",
  "Share a pack with a pack key or a short link",
  "Add a pack's maps to an osu!stable or osu!lazer collection",
  "Search and filter public packs by star rating, length, BPM and mods",
  "Public API with personal API keys",
] as const;

export const HOME_LD = ld.graph(
  ld.organization(HARUHIME_ORG),
  ld.webSite(SEO_SITE, { searchUrlTemplate: `/packs?q=${SEARCH_TERM}` }),
  ld.webApplication(SEO_SITE, { category: "UtilitiesApplication", features: APP_FEATURES }),
  ld.faq(HOME_FAQ.map(({ question, answer }) => ({ q: question, a: answer }))),
);

const TOOLS = (t: T) =>
  [
    {
      name: "pools",
      href: POOLS_URL,
      body: t("buildTheMappoolItself"),
    },
    {
      name: "bb",
      href: BB_URL,
      body: t("writeTheTournamentS"),
    },
  ] as const;

/**
 * @function HomeScreen
 * @param props {{ recent }} the newest public packs for the recent strip
 * @returns {JSX.Element} homepage body
 */
export function HomeScreen({ recent }: { recent: readonly PublicPackCard[] }) {
  const t = useTranslations("packs.homeScreen");
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title={t("osuBeatmapPacksFor")}
        lead={t("packsTurnsAMappool")}
        actions={
          <>
            <ButtonLink href="/new" size="lg">
              {t("newPack")}
            </ButtonLink>
            <ButtonLink href="/packs" size="lg" variant="secondary">
              {t("browsePublicPacks")}
            </ButtonLink>
          </>
        }
      />
      <Card title={t("haveAPackKey")}>
        <KeyPasteForm />
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES(t).map(({ title, body }) => (
          <Card key={title} title={title}>
            <p className="text-sm">{body}</p>
          </Card>
        ))}
      </div>
      {recent.length > 0 ? (
        <section aria-labelledby="recent-packs" className="flex flex-col gap-4">
          <SectionHeading
            id="recent-packs"
            actions={
              <TextLink href="/packs" className="font-bold text-sm">
                {t("seeAllPublicPacks")}
              </TextLink>
            }
          >
            {t("recentPublicPacks")}
          </SectionHeading>
          <PublicPackList packs={recent} />
        </section>
      ) : null}
      <Card title={t("questions")}>
        <div className="flex flex-col gap-4">
          {HOME_FAQ.map(({ question }, index) => (
            <div key={question}>
              <h3 className="font-bold text-c1">{t(`faq.${index}.question`)}</h3>
              <Text tone="muted" className="mt-1">
                {t(`faq.${index}.answer`)}
                {question === "What's a pack key?" ? (
                  <>
                    {" "}
                    <TextLink href="/guides/pack-key">{t("howPackKeysWork")}</TextLink>
                  </>
                ) : null}
              </Text>
            </div>
          ))}
        </div>
      </Card>
      <Card title={t("moreHaruhimeTools")}>
        <ul className="flex flex-col gap-2 text-sm">
          {TOOLS(t).map(({ name, href, body }) => (
            <li key={name}>
              <TextLink href={href}>{name}</TextLink>: {body}
            </li>
          ))}
        </ul>
      </Card>
      <JsonLd data={HOME_LD} />
    </div>
  );
}
