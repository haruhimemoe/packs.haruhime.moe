/**
 * @file tests/unit/utils/archive-names.test.ts
 * @desc parseArchiveName over real otdb pool names, the odd ones included: typos, glued years,
 *       tiers and brackets after the round, several rounds in one pool, and names with no round.
 * @author David @dvhsh (https://dvh.sh)
 * @created Thu Sep 24, 2026
 * @modified Thu Sep 24, 2026
 */

import { describe, expect, it } from "vitest";
import { type ArchiveName, parseArchiveName } from "@/utils/archive-names";

const NAMES: [string, ArchiveName][] = [
  [
    "osu! World Cup 2023 Grand Finals",
    { tournament: "osu! World Cup 2023", round: "Grand Finals", year: 2023 },
  ],
  [
    "osu! World Cup 2017 RO16",
    { tournament: "osu! World Cup 2017", round: "Round of 16", year: 2017 },
  ],
  [
    "osu! World Cup 2022 Qualifiers",
    { tournament: "osu! World Cup 2022", round: "Qualifiers", year: 2022 },
  ],
  [
    "Cindelluna's Winter Tour 2019 Finals (20k-10k)",
    { tournament: "Cindelluna's Winter Tour 2019", round: "Finals (20k-10k)", year: 2019 },
  ],
  [
    "United States Cup 2017 Quarter Finals",
    { tournament: "United States Cup 2017", round: "Quarterfinals", year: 2017 },
  ],
  [
    "United States Cup 2019 Semi Finals",
    { tournament: "United States Cup 2019", round: "Semifinals", year: 2019 },
  ],
  [
    "United States Cup 2019 round of 16",
    { tournament: "United States Cup 2019", round: "Round of 16", year: 2019 },
  ],
  [
    "Enigmatic Summer Solstice Qaurterfinal (Tier 2)",
    { tournament: "Enigmatic Summer Solstice", round: "Quarterfinals (Tier 2)", year: null },
  ],
  [
    "IHT2 2018 Quaterfinals Pool",
    { tournament: "IHT2 2018", round: "Quarterfinals Pool", year: 2018 },
  ],
  ["OZT2018 Round of 32", { tournament: "OZT2018", round: "Round of 32", year: 2018 }],
  [
    "Kawaii Squad Tournament 5 Grandfinals",
    { tournament: "Kawaii Squad Tournament 5", round: "Grand Finals", year: null },
  ],
  [
    "Ricma 4 Tier 1 Grandfinals",
    { tournament: "Ricma 4", round: "Tier 1 Grand Finals", year: null },
  ],
  [
    "Canadian Draft Cup 2020 Tier 2 Grand Finals",
    { tournament: "Canadian Draft Cup 2020", round: "Tier 2 Grand Finals", year: 2020 },
  ],
  [
    "Czechoslovak 1v1 Tourney 2020 RO32 Low Tier",
    { tournament: "Czechoslovak 1v1 Tourney 2020", round: "Round of 32 Low Tier", year: 2020 },
  ],
  [
    "Dynamic Spring Solos Finals - B Tier",
    { tournament: "Dynamic Spring Solos", round: "Finals - B Tier", year: null },
  ],
  [
    "Villoux Tournament #7 Finals / Grand Finals",
    { tournament: "Villoux Tournament #7", round: "Finals / Grand Finals", year: null },
  ],
  [
    "5 Digit North American Draft Quarterfinals & Semifinals",
    { tournament: "5 Digit North American Draft", round: "Quarterfinals & Semifinals", year: null },
  ],
  [
    "5 Digit North American Draft Swiss Round 1 & 2",
    { tournament: "5 Digit North American Draft", round: "Swiss Round 1 & 2", year: null },
  ],
  [
    "5 Digit North American Draft Finals & 3rd Place Match",
    { tournament: "5 Digit North American Draft", round: "Finals & 3rd Place Match", year: null },
  ],
  [
    "Great Singapore Tournament 2.5 Round 2",
    { tournament: "Great Singapore Tournament 2.5", round: "Round 2", year: null },
  ],
  [
    "Bundesländer Battle 2020 Groups Stage",
    { tournament: "Bundesländer Battle 2020", round: "Group Stage", year: 2020 },
  ],
  [
    "Enigmatic Snow Festival Groups (Tier 2)",
    { tournament: "Enigmatic Snow Festival", round: "Group Stage (Tier 2)", year: null },
  ],
  [
    "Five Digit Feuds II Play-Ins",
    { tournament: "Five Digit Feuds II", round: "Play-ins", year: null },
  ],
  [
    "USA States Cup 2020 Play-in",
    { tournament: "USA States Cup 2020", round: "Play-ins", year: 2020 },
  ],
  [
    "osu! French Tournament 2020 Second Stage",
    { tournament: "osu! French Tournament 2020", round: "Second Stage", year: 2020 },
  ],
  [
    "osu! French Tournament 2020 Final Stage",
    { tournament: "osu! French Tournament 2020", round: "Final Stage", year: 2020 },
  ],
  [
    "Enigmatic Autumn Tourney Stage 2",
    { tournament: "Enigmatic Autumn Tourney", round: "Stage 2", year: null },
  ],
  [
    "osu!noobs Tourney Week 3 & 4",
    { tournament: "osu!noobs Tourney", round: "Week 3 & 4", year: null },
  ],
  ["111#2 Day 2", { tournament: "111#2", round: "Day 2", year: null }],
  [
    "Icicle Heat Tournament 5.0: Revolution Round of 16",
    { tournament: "Icicle Heat Tournament 5.0: Revolution", round: "Round of 16", year: null },
  ],
  [
    "Lobby 42: Random Team Tournament Grand Finals",
    { tournament: "Lobby 42: Random Team Tournament", round: "Grand Finals", year: null },
  ],
  [
    "osu! Collegiate League: Fall 2019 Quarter Finals",
    { tournament: "osu! Collegiate League: Fall 2019", round: "Quarterfinals", year: 2019 },
  ],
  ["Dino Cup RO64", { tournament: "Dino Cup", round: "Round of 64", year: null }],
  [
    "Villoux Tournament #6 Round of 128",
    { tournament: "Villoux Tournament #6", round: "Round of 128", year: null },
  ],
  [
    "Matchmaking Pool #1 by iepie122",
    { tournament: "Matchmaking Pool #1 by iepie122", round: null, year: null },
  ],
  ["Aeris 100k-160k February", { tournament: "Aeris 100k-160k February", round: null, year: null }],
];

describe("parseArchiveName", () => {
  it.each(NAMES)("%s", (name, expected) => {
    expect(parseArchiveName(name)).toEqual(expected);
  });

  it("keeps the whole name when a round token comes first", () => {
    expect(parseArchiveName("Finals Week Cup")).toEqual({
      tournament: "Finals Week Cup",
      round: null,
      year: null,
    });
  });

  it("drops separators before the round and squashes spaces", () => {
    expect(parseArchiveName("  Spring  Cup 2024 -  Semifinals ")).toEqual({
      tournament: "Spring Cup 2024",
      round: "Semifinals",
      year: 2024,
    });
    expect(parseArchiveName("Spring Cup: Quals")).toMatchObject({
      tournament: "Spring Cup",
      round: "Qualifiers",
    });
  });

  it("reads a year from the round when the tournament has none, and never before 2007", () => {
    expect(parseArchiveName("Spring Cup Finals 2021")).toMatchObject({ year: 2021 });
    expect(parseArchiveName("Spring Cup 2005 Finals")).toMatchObject({ year: null });
    expect(parseArchiveName("Spring Cup 12024 Finals")).toMatchObject({ year: null });
  });
});
