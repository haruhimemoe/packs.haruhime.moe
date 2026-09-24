/**
 * @file tests/unit/utils/magnet.test.ts
 * @desc Magnet links: building one, reading the v1 infohash back out, and rebuilding an untrusted
 *       link from only its infohash, name, size, and our own trackers.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Wed Sep 23, 2026
 */

import { describe, expect, it } from "vitest";
import { MAX_MAGNET_LENGTH } from "@/constants/pack";
import { TRACKERS } from "@/constants/trackers";
import { magnetSchema } from "@/schemas/pack-export";
import {
  canonicalLinks,
  canonicalMagnet,
  infohashOf,
  MAX_DISPLAY_NAME,
  magnetUri,
} from "@/utils/magnet";

const HASH = "d63ba49c4cbf76ee46bfc94476183f1710de7d09";

describe("magnetUri", () => {
  it("builds xt, dn, xl, then one tr per tracker, all encoded", () => {
    expect(
      magnetUri({
        infoHash: HASH,
        name: "SPC & Co / Finals",
        totalBytes: 11,
        trackers: ["udp://a:1/announce", "wss://b"],
      }),
    ).toBe(
      `magnet:?xt=urn:btih:${HASH}&dn=SPC%20%26%20Co%20%2F%20Finals&xl=11&tr=udp%3A%2F%2Fa%3A1%2Fannounce&tr=wss%3A%2F%2Fb`,
    );
  });

  it("encodes non-ASCII names", () => {
    expect(magnetUri({ infoHash: HASH, name: "ポケモン", totalBytes: 1, trackers: [] })).toContain(
      "&dn=%E3%83%9D%E3%82%B1%E3%83%A2%E3%83%B3&",
    );
  });
});

describe("infohashOf", () => {
  it("reads the hash back from a magnet we built", () => {
    expect(infohashOf(magnetUri({ infoHash: HASH, name: "x", totalBytes: 1, trackers: [] }))).toBe(
      HASH,
    );
  });

  it("lower-cases an upper-case hash", () => {
    expect(infohashOf(`magnet:?xt=urn:btih:${HASH.toUpperCase()}`)).toBe(HASH);
  });

  it.each([
    ["another scheme", `https://example.com/?xt=urn:btih:${HASH}`],
    ["javascript", `javascript:alert(1)//magnet:?xt=urn:btih:${HASH}`],
    ["no xt", "magnet:?dn=x"],
    ["two xt", `magnet:?xt=urn:btih:${HASH}&xt=urn:btih:${HASH}`],
    ["a base32 hash", "magnet:?xt=urn:btih:MFRGGZDFMZTWQ2LKNNWG23TPOBYXE43U"],
    ["a v2 hash", `magnet:?xt=urn:btmh:1220${HASH}${HASH.slice(0, 24)}`],
    ["a short hash", `magnet:?xt=urn:btih:${HASH.slice(1)}`],
    ["a numbered second topic", `magnet:?xt=urn:btih:${HASH}&xt.1=urn:btih:${HASH}`],
  ])("rejects %s", (_label, url) => {
    expect(infohashOf(url)).toBeNull();
  });
});

describe("canonicalMagnet", () => {
  const OURS = TRACKERS[0] ?? "";
  const enc = encodeURIComponent;
  const base = `magnet:?xt=urn:btih:${HASH}&dn=SPC&xl=11`;

  it("passes a magnet we built through unchanged", () => {
    const made = magnetUri({
      infoHash: HASH,
      name: "SPC Quals",
      totalBytes: 50_005,
      trackers: TRACKERS,
    });
    expect(canonicalMagnet(made)).toBe(made);
  });

  it.each([
    ["ws (web seed)", "ws", "http://192.168.0.1/some/path"],
    ["xs (torrent source)", "xs", "http://attacker.example/x.torrent"],
    ["as (acceptable source)", "as", "http://attacker.example/x.osz"],
    ["x.pe (peer)", "x.pe", "10.0.0.5:22"],
    ["so (file selection)", "so", "0,2-4"],
    ["kt (keywords)", "kt", "owc"],
    ["mt (manifest)", "mt", "http://attacker.example/list"],
    ["an unknown key", "foo", "bar"],
  ])("drops %s", (_label, key, value) => {
    expect(canonicalMagnet(`${base}&${key}=${enc(value)}`)).toBe(base);
  });

  it("drops trackers that aren't ours and keeps ours", () => {
    const url = `${base}&tr=${enc("http://tracker.attacker.example/announce")}&tr=${enc(OURS)}`;
    expect(canonicalMagnet(url)).toBe(`${base}&tr=${enc(OURS)}`);
  });

  it("matches our trackers case-insensitively and without a trailing slash, writes ours", () => {
    const url = `${base}&tr=${enc(`${OURS.toUpperCase()}/`)}&tr=${enc(OURS)}`;
    expect(canonicalMagnet(url)).toBe(`${base}&tr=${enc(OURS)}`);
  });

  it("lists kept trackers once, in our order", () => {
    const [first = "", second = ""] = TRACKERS;
    const url = `${base}&tr=${enc(second)}&tr=${enc(first)}&tr=${enc(second)}`;
    expect(canonicalMagnet(url)).toBe(`${base}&tr=${enc(first)}&tr=${enc(second)}`);
  });

  it("lower-cases the hash and puts the fields in a fixed order", () => {
    const url = `magnet:?tr=${enc(OURS)}&xl=11&dn=SPC&xt=URN:BTIH:${HASH.toUpperCase()}`;
    expect(canonicalMagnet(url)).toBe(`${base}&tr=${enc(OURS)}`);
  });

  it("gives the same output for the same input", () => {
    const url = `${base}&ws=http%3A%2F%2Fx&tr=${enc(OURS)}`;
    expect(canonicalMagnet(url)).toBe(canonicalMagnet(url));
    expect(canonicalMagnet(canonicalMagnet(url) ?? "")).toBe(canonicalMagnet(url));
  });

  it("keeps only the hash when there's no name, size, or tracker", () => {
    expect(canonicalMagnet(`magnet:?xt=urn:btih:${HASH}`)).toBe(`magnet:?xt=urn:btih:${HASH}`);
  });

  it("strips control characters from the name and caps its length", () => {
    expect(canonicalMagnet(`magnet:?xt=urn:btih:${HASH}&dn=a%00b%0Ac%1B%7Fd%E2%80%AEe`)).toBe(
      `magnet:?xt=urn:btih:${HASH}&dn=abcde`,
    );
    const long = "ポ".repeat(MAX_DISPLAY_NAME + 5);
    expect(canonicalMagnet(`magnet:?xt=urn:btih:${HASH}&dn=${enc(long)}`)).toBe(
      `magnet:?xt=urn:btih:${HASH}&dn=${enc("ポ".repeat(MAX_DISPLAY_NAME))}`,
    );
  });

  it("drops a name that is empty once cleaned", () => {
    expect(canonicalMagnet(`magnet:?xt=urn:btih:${HASH}&dn=%00%01`)).toBe(
      `magnet:?xt=urn:btih:${HASH}`,
    );
  });

  it.each(["0", "-5", "1.5", "12abc", "1e6", "99999999999999999999"])("drops the size %j", (xl) => {
    expect(canonicalMagnet(`magnet:?xt=urn:btih:${HASH}&xl=${xl}`)).toBe(
      `magnet:?xt=urn:btih:${HASH}`,
    );
  });

  it.each([
    ["two xt", `magnet:?xt=urn:btih:${HASH}&xt=urn:btih:${"b".repeat(40)}`],
    ["the same xt twice", `magnet:?xt=urn:btih:${HASH}&xt=urn:btih:${HASH}`],
    ["a numbered second topic", `magnet:?xt=urn:btih:${HASH}&xt.1=urn:btih:${HASH}`],
    ["two names", `magnet:?xt=urn:btih:${HASH}&dn=a&dn=b`],
    ["two sizes", `magnet:?xt=urn:btih:${HASH}&xl=1&xl=2`],
    ["no xt", "magnet:?dn=x"],
    ["a base32 hash", "magnet:?xt=urn:btih:MFRGGZDFMZTWQ2LKNNWG23TPOBYXE43U"],
    ["a v2 hash", `magnet:?xt=urn:btmh:1220${HASH}${HASH.slice(0, 24)}`],
    ["javascript:", `javascript:alert(1)//magnet:?xt=urn:btih:${HASH}`],
    ["data:", `data:text/html,magnet:?xt=urn:btih:${HASH}`],
    ["http:", `http://example.com/?xt=urn:btih:${HASH}`],
    ["an empty string", ""],
  ])("rejects %s", (_label, url) => {
    expect(canonicalMagnet(url)).toBeNull();
  });
});

describe("canonicalMagnet caps the length", () => {
  const worstName = "\u{1F600}".repeat(MAX_DISPLAY_NAME);
  const worstCase = (trackers: readonly string[]) =>
    `magnet:?xt=urn:btih:${HASH}&dn=${encodeURIComponent(worstName)}&xl=11${trackers
      .map((tracker) => `&tr=${encodeURIComponent(tracker)}`)
      .join("")}`;

  it(`keeps the worst-case name under ${MAX_MAGNET_LENGTH} with today's trackers`, () => {
    const out = canonicalMagnet(worstCase(TRACKERS));
    expect(out).not.toBeNull();
    expect((out ?? "").length).toBeLessThanOrEqual(MAX_MAGNET_LENGTH);
    expect(out).toContain("&dn=");
    // Never throws when it reaches the same schema toSavedPack parses against.
    expect(() => magnetSchema.parse(out)).not.toThrow();
  });

  it("drops the name first when a longer tracker list would push the link past the cap", () => {
    const manyTrackers = [
      ...TRACKERS,
      ...Array.from({ length: 20 }, (_, i) => `udp://extra-tracker-${i}.example.org:6969/announce`),
    ];
    const out = canonicalMagnet(worstCase(manyTrackers), manyTrackers);
    expect(out).not.toBeNull();
    expect((out ?? "").length).toBeLessThanOrEqual(MAX_MAGNET_LENGTH);
    expect(out).not.toContain("&dn=");
    expect(out).toContain(`xt=urn:btih:${HASH}`);
    expect(() => magnetSchema.parse(out)).not.toThrow();
  });

  it("returns null when it's still too long even without the name", () => {
    const tooManyTrackers = Array.from(
      { length: 80 },
      (_, i) => `udp://extra-tracker-${i}.example.org:6969/announce`,
    );
    expect(canonicalMagnet(worstCase(tooManyTrackers), tooManyTrackers)).toBeNull();
  });

  it("a legacy stored link that grew past the cap comes out dropped or shortened, never throwing", () => {
    // Simulates M-1: a link that canonicalized fine when it was stored, but the tracker list
    // (or another future field) grew, so the rebuilt link would now outgrow MAX_MAGNET_LENGTH.
    const legacy = `magnet:?xt=urn:btih:${HASH}&dn=${encodeURIComponent(worstName)}`;
    const grownTrackers = [
      ...TRACKERS,
      ...Array.from({ length: 20 }, (_, i) => `udp://extra-tracker-${i}.example.org:6969/announce`),
    ];
    const rebuilt = canonicalLinks([{ url: legacy }], grownTrackers);
    for (const entry of rebuilt) {
      expect(entry.url.length).toBeLessThanOrEqual(MAX_MAGNET_LENGTH);
      expect(() => magnetSchema.parse(entry.url)).not.toThrow();
    }
  });
});

describe("canonicalLinks", () => {
  it("rebuilds each url, drops non-magnets, keeps the first entry per infohash", () => {
    const other = "b".repeat(40);
    expect(
      canonicalLinks(
        [
          { id: 1, url: `magnet:?xt=urn:btih:${HASH}&ws=http%3A%2F%2Fx` },
          { id: 2, url: "javascript:alert(1)" },
          { id: 3, url: `magnet:?xt=urn:btih:${HASH.toUpperCase()}&dn=again` },
          {
            id: 4,
            url: `magnet:?xt=urn:btih:${other}&tr=${encodeURIComponent("wss://x.example")}`,
          },
        ],
        ["wss://x.example"],
      ),
    ).toEqual([
      { id: 1, url: `magnet:?xt=urn:btih:${HASH}` },
      { id: 4, url: `magnet:?xt=urn:btih:${other}&tr=wss%3A%2F%2Fx.example` },
    ]);
  });
});
