import rawPalettes from "../assets/data/palettes.txt?raw";
import puzzleData from "../assets/data/puzzle_data.txt?raw";
import type { HsvColor, WorldModel } from "./model";

type ColorCategory = "root" | "orange" | "blue" | "player" | "teal" | "green";
type Palette = Record<ColorCategory, HsvColor>;
const categories = new Set<ColorCategory>(["root", "orange", "blue", "player", "teal", "green"]);

/** Native Hub.Init parses Resources/palettes into six HSV categories. */
export const originalPalettes: readonly Palette[] = (() => {
  const palettes: Partial<Palette>[] = [];
  for (const rawLine of rawPalettes.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const [name, h, s, v] = line.split(/\s+/);
    if (name === "palette") { palettes.push({}); continue; }
    if (!categories.has(name as ColorCategory) || !palettes.length || h === undefined || s === undefined || v === undefined) throw new Error("Invalid original palette resource");
    palettes[palettes.length - 1]![name as ColorCategory] = { h: Math.fround(Number(h)), s: Math.fround(Number(s)), v: Math.fround(Number(v)) };
  }
  if (palettes.some((palette) => [...categories].some((category) => !palette[category]))) throw new Error("Incomplete original palette");
  return palettes as Palette[];
})();

// Kept independent of progression/customLevels to avoid a parser import cycle.
const scenePalettes = new Map(puzzleData.trim().split(/\r?\n/).map((line) => {
  const fields = line.trim().split(/\s+/);
  return [fields[0]!, Number(fields[3])] as const;
}));
export function scenePaletteIndex(levelName: string): number { return scenePalettes.get(levelName) ?? 0; }

/** Called once after references and generated worlds exist, matching LoadLevel. */
export function applyScenePalette(world: WorldModel, source: string): number | null {
  if (world.levelName === "hub" || world.levelName === "palettes") return null;
  let index = scenePaletteIndex(world.levelName);
  if (world.levelName === "custom_level") {
    const header = source.split(/^\s*#\s*$/m, 1)[0]!;
    const match = /^\s*palette\s+(-?\d+)\s*$/m.exec(header);
    index = match ? Number(match[1]) : -1;
    if (index < 0) return null;
  }
  const palette = originalPalettes[index];
  if (!palette) throw new RangeError(`Unknown original palette ${index}`);
  for (const block of world.blocks) {
    if (!block.subLevel || block.subLevel.infZone) continue;
    const hue = Math.fround(block.color.h);
    const category: ColorCategory | null = block.color.s === 0 ? "root" :
      hue === Math.fround(0.6) ? "blue" : hue === Math.fround(0.4) ? "green" :
      hue === Math.fround(0.1) ? "orange" : hue === Math.fround(0.9) ? "player" :
      hue === Math.fround(0.55) ? "teal" : null;
    if (category) block.color = { ...palette[category] };
  }
  return index;
}
