/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import data from "../src/assets/data/native-font-metrics.json";
import { nativeFontSizes, nativeGlyphQuads, nativeTextWidth } from "../src/render/nativeFontRendering";
import { readRgbaPng } from "./helpers/readRgbaPng";

const root = fileURLToPath(new URL("../", import.meta.url));
const rawPath = root + data.source + "/";
const source = JSON.parse(readFileSync(rawPath + "font-metrics.json", "utf8")) as {
  metrics: Array<{fontSize: number; glyphs: Array<{character: string; advance: number; bounds: number[];
    glyphWidth: number; glyphHeight: number; uvTopLeft: number[]; uvTopRight: number[]; uvBottomLeft: number[]}>}>;
};
const native = readRgbaPng(rawPath + "font-atlas.png");
const packed = readRgbaPng(root + "src/assets/fonts/native-jost-atlas.png");
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

describe("same-generation native font atlas", () => {
  it("pins both native inputs and the reproducible packed atlas", () => {
    expect(hash(readFileSync(rawPath + "font-atlas.png"))).toBe(data.sourceAtlasSha256);
    expect(hash(readFileSync(rawPath + "font-metrics.json"))).toBe(data.sourceMetricsSha256);
    expect(hash(readFileSync(root + "src/assets/fonts/native-jost-atlas.png"))).toBe(data.atlasSha256);
    expect(source.metrics.reduce((count, size) => count + size.glyphs.length, 0)).toBe(285);
  });
  for (const size of source.metrics) {
    it(`preserves every alpha sample, signed bearing and advance at${size.fontSize}px`, () => {
      const font = nativeFontSizes[size.fontSize]!;
      expect(Object.keys(font.glyphs)).toHaveLength(95);
      for (const glyph of size.glyphs) {
        const target = font.glyphs[glyph.character]!;
        expect(target.advance).toBe(glyph.advance);
        expect(target.bounds).toEqual(glyph.bounds);
        const [x, y, width, height] = target.frame;
        expect([width, height]).toEqual([glyph.glyphWidth, glyph.glyphHeight]);
        for (let gy = 0; gy < height!; gy++) for (let gx = 0; gx < width!; gx++) {
          const u = glyph.uvTopLeft[0]! + (glyph.uvTopRight[0]! - glyph.uvTopLeft[0]!) * (gx + 0.5) / width!
            + (glyph.uvBottomLeft[0]! - glyph.uvTopLeft[0]!) * (gy + 0.5) / height!;
          const v = glyph.uvTopLeft[1]! + (glyph.uvTopRight[1]! - glyph.uvTopLeft[1]!) * (gx + 0.5) / width!
            + (glyph.uvBottomLeft[1]! - glyph.uvTopLeft[1]!) * (gy + 0.5) / height!;
          const sourceOffset = (Math.floor((1 - v) * native.height) * native.width + Math.floor(u * native.width)) * 4;
          const targetOffset = ((y! + gy) * packed.width + x! + gx) * 4;
          expect(Array.from(packed.pixels.subarray(targetOffset, targetOffset + 4))).toEqual([255, 255, 255, native.pixels[sourceOffset + 3]]);
        }
      }
    });
  }
});

describe("native glyph baseline quads", () => {
  it.each([[12, 30], [16, 40], [20, 50]])("retains measured Move width at%ipx", (size, width) => {
    expect(nativeTextWidth("Move", size!)).toBe(width);
  });
  it("uses signed CharacterInfo bearings and original advances", () => {
    const quads = nativeGlyphQuads("Move", 12, 62, 369)!;
    expect(quads.map(({x, y, width, height}) => [x, y, width, height])).toEqual([
      [61, 359, 12, 11], [71, 362, 9, 9], [77, 362, 10, 9], [84, 362, 9, 9],
    ]);
  });
  it("reports uncaptured sizes or characters for the existing text fallback", () => {
    expect(nativeTextWidth("Move", 13)).toBeNull();
    expect(nativeGlyphQuads("移动", 12, 0, 0)).toBeNull();
  });
});
