/**
 * @file tests/unit/utils/osz-backgrounds.test.ts
 * @desc Background finder: path matching, [Events] parsing (quotes, keywords, commands, other
 *       sections), storyboard sprites/animations/variables, and which entries get dropped.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

import { describe, expect, it } from "vitest";
import { backgroundsToRemove, eventFiles, normalizeOszPath } from "@/utils/osz-backgrounds";
import { osuFile } from "../../helpers/osz-fixtures";

describe("normalizeOszPath", () => {
  it.each([
    ["BG.JPG", "bg.jpg"],
    ["sb\\Back Ground.png", "sb/back ground.png"],
    ["./sb//bg.png", "sb/bg.png"],
    ["  bg.jpg ", "bg.jpg"],
  ])("%j → %j", (input, output) => {
    expect(normalizeOszPath(input)).toBe(output);
  });
});

describe("eventFiles", () => {
  it("reads a quoted background name with spaces and commas", () => {
    const text = osuFile(['0,0,"my bg, final (1).jpg",0,0']);
    expect(eventFiles(text).backgrounds).toEqual(["my bg, final (1).jpg"]);
  });

  it("reads the Background keyword and unquoted names", () => {
    const text = osuFile(['Background,0,"kw.png"', "0,0,plain.jpg,0,0"]);
    expect(eventFiles(text).backgrounds).toEqual(["kw.png", "plain.jpg"]);
  });

  it("ignores videos, breaks, commands, comments and other sections", () => {
    const text = osuFile([
      'Video,0,"clip.mp4"',
      '1,0,"clip2.avi"',
      "2,100,200",
      " F,0,0,,1",
      '// 0,0,"c.jpg"',
    ]);
    const withColours = `${text}\r\n[Colours]\r\n0,0,"not-events.jpg"`;
    expect(eventFiles(withColours)).toEqual({ backgrounds: [], storyboard: [] });
  });

  it("reads storyboard sprites and animation frames, with .osb variables", () => {
    const osb = [
      "[Variables]",
      '$bg="bg.jpg"',
      "[Events]",
      "Sprite,Background,Centre,$bg,320,240",
      " F,0,0,1000,1",
      'Animation,Foreground,Centre,"sb\\fire.png",320,240,3,50,LoopForever',
      '4,3,1,"sb/star.png",0,0',
    ].join("\n");
    expect(eventFiles(osb, true).storyboard).toEqual([
      "bg.jpg",
      "sb\\fire.png",
      "sb\\fire0.png",
      "sb\\fire1.png",
      "sb\\fire2.png",
      "sb/star.png",
    ]);
  });
});

describe("backgroundsToRemove", () => {
  const entries = [
    "hard.osu",
    "insane.osu",
    "audio.mp3",
    "BG.jpg",
    "sb/Other BG.png",
    "shared.jpg",
    "sb/star.png",
  ];

  it("drops every diff's background, matched without case and with Windows paths", () => {
    const scripts = [
      { name: "hard.osu", text: osuFile(['0,0,"bg.jpg",0,0']) },
      { name: "insane.osu", text: osuFile(['0,0,"SB\\other bg.PNG",0,0']) },
    ];
    expect(backgroundsToRemove(scripts, entries)).toEqual(["BG.jpg", "sb/Other BG.png"]);
  });

  it("keeps a background the storyboard also uses", () => {
    const scripts = [
      { name: "hard.osu", text: osuFile(['0,0,"shared.jpg",0,0']) },
      { name: "set.osb", text: '[Events]\nSprite,Background,Centre,"shared.jpg",320,240\n' },
    ];
    expect(backgroundsToRemove(scripts, entries)).toEqual([]);
  });

  it("keeps a background a diff's own storyboard uses", () => {
    const scripts = [
      {
        name: "hard.osu",
        text: osuFile(['0,0,"bg.jpg",0,0', 'Sprite,Background,Centre,"BG.JPG",320,240']),
      },
    ];
    expect(backgroundsToRemove(scripts, entries)).toEqual([]);
  });

  it("ignores a background that isn't in the archive", () => {
    const scripts = [{ name: "hard.osu", text: osuFile(['0,0,"missing.jpg",0,0']) }];
    expect(backgroundsToRemove(scripts, entries)).toEqual([]);
  });

  it("only ever drops images, even if a line names another file", () => {
    const scripts = [
      { name: "hard.osu", text: osuFile(['0,0,"audio.mp3",0,0', '0,0,"insane.osu",0,0']) },
    ];
    expect(backgroundsToRemove(scripts, entries)).toEqual([]);
  });
});
