/**
 * @file src/utils/osz-backgrounds.ts
 * @desc Finds a beatmapset's background-only images from its .osu/.osb text: background event
 *       lines (type 0 or Background) minus anything a storyboard Sprite or Animation also uses.
 *       Paths compare the way osu! looks them up on Windows: case-insensitive, \ and / alike.
 * @author David @dvhsh (https://dvh.sh)
 * @created Tue Sep 22, 2026
 * @modified Tue Sep 22, 2026
 */

export type OszScript = { name: string; text: string };
type EventFiles = { backgrounds: string[]; storyboard: string[] };

const BACKGROUND = new Set(["0", "Background"]);
const SPRITE = new Set(["4", "Sprite"]);
const ANIMATION = new Set(["6", "Animation"]);
const MAX_FRAMES = 1000;
// Only images are ever dropped, whatever a malformed line names.
const IMAGE = /\.(jpe?g|png|bmp|gif|webp)$/i;

/**
 * @function normalizeOszPath
 * @param path {string} a path from a .osu/.osb line or a zip entry name
 * @returns {string} lower-case, forward slashes, no leading "./" or "/", so osu!'s
 *          case-insensitive Windows-style lookups compare equal
 */
export const normalizeOszPath = (path: string): string =>
  path
    .trim()
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^(\.\/|\/)+/, "")
    .toLowerCase();

/** Comma-separated fields; a field starting with a quote runs to the next quote. */
const fields = (line: string): string[] => {
  const out: string[] = [];
  let i = 0;
  for (;;) {
    if (line[i] === '"') {
      const close = line.indexOf('"', i + 1);
      if (close === -1) {
        out.push(line.slice(i + 1));
        return out;
      }
      out.push(line.slice(i + 1, close));
      const comma = line.indexOf(",", close);
      if (comma === -1) return out;
      i = comma + 1;
    } else {
      const comma = line.indexOf(",", i);
      if (comma === -1) {
        out.push(line.slice(i));
        return out;
      }
      out.push(line.slice(i, comma));
      i = comma + 1;
    }
  }
};

const animationFrames = (path: string, frameCount: string | undefined): string[] => {
  const count = Math.min(Number.parseInt(frameCount ?? "", 10) || 0, MAX_FRAMES);
  const dot = path.lastIndexOf(".");
  const [stem, ext] = dot === -1 ? [path, ""] : [path.slice(0, dot), path.slice(dot)];
  return [path, ...Array.from({ length: count }, (_, frame) => `${stem}${frame}${ext}`)];
};

/**
 * @function eventFiles
 * @param text {string} a .osu or .osb file
 * @param isStoryboardFile {boolean} true for .osb (every section but [Variables] holds events)
 * @returns {EventFiles} background image paths and storyboard image paths, as written
 */
export const eventFiles = (text: string, isStoryboardFile = false): EventFiles => {
  const backgrounds: string[] = [];
  const storyboard: string[] = [];
  const variables: [string, string][] = [];
  let section = "";
  for (const raw of text.split(/\r?\n/)) {
    const header = /^\s*\[(.+)\]\s*$/.exec(raw);
    if (header) {
      section = header[1] ?? "";
      continue;
    }
    if (section === "Variables") {
      const match = /^(\$[^=]+)=(.*)$/.exec(raw.trim());
      if (match) variables.push([match[1] ?? "", match[2] ?? ""]);
      continue;
    }
    if (section !== "Events" && !isStoryboardFile) continue;
    // Indented lines are storyboard commands; "//" lines are comments.
    if (raw === "" || raw.startsWith(" ") || raw.startsWith("_") || raw.startsWith("//")) continue;
    let line = raw.trimEnd();
    if (line.includes("$")) {
      for (const [name, value] of [...variables].sort((a, b) => b[0].length - a[0].length)) {
        line = line.split(name).join(value);
      }
    }
    const [type = "", , third, fourth, , , seventh] = fields(line);
    if (BACKGROUND.has(type) && third) backgrounds.push(third);
    else if (SPRITE.has(type) && fourth) storyboard.push(fourth);
    else if (ANIMATION.has(type) && fourth) storyboard.push(...animationFrames(fourth, seventh));
  }
  return { backgrounds, storyboard };
};

/**
 * @function backgroundsToRemove
 * @param scripts {readonly OszScript[]} every .osu and .osb in the set, decoded
 * @param entryNames {readonly string[]} every entry name in the archive
 * @returns {string[]} the entry names that are only ever used as a background, in archive order
 */
export const backgroundsToRemove = (
  scripts: readonly OszScript[],
  entryNames: readonly string[],
): string[] => {
  const backgrounds = new Set<string>();
  const storyboard = new Set<string>();
  for (const { name, text } of scripts) {
    const lower = name.toLowerCase();
    const isOsb = lower.endsWith(".osb");
    if (!isOsb && !lower.endsWith(".osu")) continue;
    const found = eventFiles(text, isOsb);
    for (const path of found.backgrounds) backgrounds.add(normalizeOszPath(path));
    for (const path of found.storyboard) storyboard.add(normalizeOszPath(path));
  }
  return entryNames.filter((entry) => {
    const path = normalizeOszPath(entry);
    return IMAGE.test(path) && backgrounds.has(path) && !storyboard.has(path);
  });
};
