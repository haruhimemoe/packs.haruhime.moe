/**
 * @file src/components/home/HomeScreen.tsx
 * @desc Homepage body: hero, pack key box, what it does, recent public packs, FAQ, and the
 *       WebApplication + FAQPage structured data.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Thu Sep 24, 2026
 */

import { ButtonLink, Card, JsonLd, PageHeader } from "@haruhimemoe/ui";
import Link from "next/link";
import { KeyPasteForm } from "@/components/pack/KeyPasteForm";
import { PublicPackList } from "@/components/packs/PublicPackList";
import { SITE } from "@/constants/site";
import type { PublicPackCard } from "@/schemas/public-pack";

const FEATURES = [
  {
    title: "Build",
    body: "Paste IDs, links, or a whole spreadsheet. Maps land in NM, HD, HR, DT, FM, TB or your own slots.",
  },
  {
    title: "Share",
    body: "Every pack has a pack key anyone can open, no account needed. Save it to get a short link.",
  },
  {
    title: "Download",
    body: "Get the whole pool as one zip or a torrent, numbered in pool order, with a pack.txt listing every map.",
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
      "A pack matches when its star rating, length or BPM range overlaps the range you set, when it has every mod and mode you tick, when its map count is in range, and when it comes from a source you tick (community packs, archived pools, or both). While a star rating, length, BPM, mod or mode filter is set, packs whose stats aren't ready yet are hidden, and the list says how many.",
  },
  {
    question: "How can I sort public packs?",
    answer:
      "By newest (the default, community packs first), recently updated, star rating low to high or high to low, most maps, or name. Pinned packs sit above the list until you search, filter or sort.",
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
] as const;

const WEB_APPLICATION = {
  "@type": "WebApplication",
  name: SITE.name,
  url: SITE.url,
  description: SITE.description,
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const FAQ_PAGE = {
  "@type": "FAQPage",
  mainEntity: HOME_FAQ.map(({ question, answer }) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export function HomeScreen({ recent }: { recent: readonly PublicPackCard[] }) {
  return (
    <div className="flex flex-col gap-10">
      <PageHeader
        title="osu! beatmap packs for tournament hosts"
        lead="packs turns a mappool into one download. Paste beatmap IDs or links, sort them into slots, and share the pack with a key or a short link."
        actions={
          <>
            <ButtonLink href="/new" size="lg">
              New pack
            </ButtonLink>
            <ButtonLink href="/packs" size="lg" variant="secondary">
              Browse public packs
            </ButtonLink>
          </>
        }
      />
      <Card title="Have a pack key?">
        <KeyPasteForm />
      </Card>
      <div className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map(({ title, body }) => (
          <Card key={title} title={title}>
            <p className="text-sm">{body}</p>
          </Card>
        ))}
      </div>
      {recent.length > 0 ? (
        <section aria-labelledby="recent-packs" className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="recent-packs" className="font-bold text-c1 text-xl">
              Recent public packs
            </h2>
            <Link href="/packs" className="font-bold text-h1 text-sm hover:text-c1">
              See all public packs
            </Link>
          </div>
          <PublicPackList packs={recent} />
        </section>
      ) : null}
      <Card title="Questions">
        <div className="flex flex-col gap-4">
          {HOME_FAQ.map(({ question, answer }) => (
            <div key={question}>
              <h3 className="font-bold text-c1">{question}</h3>
              <p className="mt-1 text-c3 text-sm">
                {answer}
                {question === "What's a pack key?" ? (
                  <>
                    {" "}
                    <Link href="/guide/pack-key" className="text-h1 underline hover:text-c1">
                      How pack keys work
                    </Link>
                  </>
                ) : null}
              </p>
            </div>
          ))}
        </div>
      </Card>
      <JsonLd data={WEB_APPLICATION} />
      <JsonLd data={FAQ_PAGE} />
    </div>
  );
}
