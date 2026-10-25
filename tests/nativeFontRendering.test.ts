/// <reference types="node" />
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import data from "../src/assets/data/native-font-metrics.json";
import { nativeCaptionQuads, nativeFontSizes, nativeGlyphQuads, nativeGuiBaselines, nativeGuiPenX, nativeMoveCaptionQuads, nativeTextWidth } from "../src/render/nativeFontRendering";
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

type NativeLabelSample = {
  size?: number; text: string; rect: [number, number, number, number]; advanceWidth: number;
  actualPenX: number; actualBaseline?: number; baseline?: number; role?: "MiddleCenter" | "UpperLeft";
};
const centeredEvidence = [
  ["font-sampling-native-index.json", "8808df3eeecd241a4429f58f461ff6c0f7d1595b5cea20c2721ab7c5cf9bb1ea", 405],
  ["font-alignment-pairs-native-index.json", "53b78fc59c9f17052489667925e195065a5b9807742fadd61dc9d5e125a57445", 16],
  ["font-variety-native-index.json", "65f078cfaf10969638674f387ad4394332d765dceb02578c7ee76fbcd7dc3d3f", 72],
] as const;

describe("source-derived native GUI horizontal stages", () => {
  for (const [name, sha256, count] of centeredEvidence) {
    it(`matches all${count} native labels in ${name}`, () => {
      const bytes = readFileSync(root + "docs/parity/evidence/original/" + name);
      expect(hash(bytes)).toBe(sha256);
      const evidence = JSON.parse(bytes.toString("utf8")) as {capture?: {fontSize: number}; samples: NativeLabelSample[]};
      expect(evidence.samples).toHaveLength(count);
      for (const sample of evidence.samples) {
        const [x, y, width, height] = sample.rect;
        const rect = {x, y, width, height};
        const fontSize = sample.size ?? evidence.capture!.fontSize;
        const alignment = sample.role ?? "MiddleCenter";
        expect(nativeTextWidth(sample.text, fontSize)).toBe(sample.advanceWidth);
        expect(nativeGuiPenX(sample.advanceWidth, rect, alignment)).toBe(sample.actualPenX);
        if (alignment === "UpperLeft") continue;
        const quads = nativeCaptionQuads(sample.text, fontSize, rect)!;
        expect(quads).toHaveLength(sample.text.length);
        const first = nativeFontSizes[fontSize]!.glyphs[sample.text[0]!]!;
        expect(quads[0]!.x - first.bounds[0]!).toBe(sample.actualPenX);
        expect(quads[0]!.y + first.bounds[3]!).toBe(sample.actualBaseline ?? sample.baseline);
      }
    });
  }
  it("retains the prior351/405 candidate and resolves its54 measured failures", () => {
    const path = root + "docs/parity/evidence/original/font-sampling-native-index.json";
    const {samples} = JSON.parse(readFileSync(path, "utf8")) as {samples: NativeLabelSample[]};
    const failures = samples.filter(sample => Math.ceil(sample.rect[0] - .5) + Math.floor(sample.rect[2] / 2)
      - Math.ceil(sample.advanceWidth / 2) !== sample.actualPenX);
    expect(failures).toHaveLength(54);
    for (const sample of failures) expect(nativeGuiPenX(sample.advanceWidth, {x: sample.rect[0], width: sample.rect[2]})).toBe(sample.actualPenX);
  });
  it.each([0, -.25])("reproduces actual centered/UpperLeft U residual atorigin%s", origin => {
    expect(nativeGuiPenX(11, {x: 20 + origin, width: 362})).toBe(194);
    expect(nativeGuiPenX(11, {x: 595 + origin, width: 362}, "UpperLeft")).toBe(595);
  });
  it("centers each explicit line relative to the shared native text block", () => {
    const rect = {x: 20, y: 10, width: 362, height: 82};
    const baselines = nativeGuiBaselines("Move\nU", 16, rect)!;
    const quads = nativeCaptionQuads("Move\nU", 16, rect)!;
    expect(quads[0]!.x).toBe(180);
    expect(quads[4]!.x).toBe(195);
    expect(quads[0]!.y).toBe(baselines[0]! - 13);
    expect(quads[4]!.y).toBe(baselines[1]! - 13);
  });
  it("retains explicit fallback for uncaptured glyphs, rich text and wrapping", () => {
    const rect = {x: 0, y: 0, width: 10, height: 82};
    expect(nativeCaptionQuads("Move", 13, rect)).toBeNull();
    expect(nativeCaptionQuads("移动", 16, rect)).toBeNull();
    expect(nativeCaptionQuads("<b>U</b>", 16, rect)).toBeNull();
    expect(nativeCaptionQuads("Move", 16, rect)).toBeNull();
  });
});

describe("native glyph baseline quads", () => {
  it("derives hinted ascent from native TextGenerator geometry, not screenshot offsets", () => {
    const path = root + data.layoutSource;
    expect(hash(readFileSync(path))).toBe(data.layoutMetricsSha256);
    const layout = JSON.parse(readFileSync(path, "utf8")) as {measurements: Array<{size: number;
      textGenerator: {vertices: number[][]; characters: Array<{cursorPos: {y: number}}>}}>} ;
    for (const row of layout.measurements) {
      const ascent = -row.textGenerator.vertices[0]![1]! + nativeFontSizes[row.size]!.glyphs.M!.bounds[3]!
        + row.textGenerator.characters[1]!.cursorPos.y;
      expect(nativeFontSizes[row.size]!.hintedAscent).toBe(ascent);
    }
  });
  it("matches66 independent native label baselines including odd extents and negative origins", () => {
    let count = 0;
    for (const folder of ["native-gui-font-pack-v7-20261025", "native-gui-font-pack-odd-v8-20261025", "native-gui-font-pack-falsify-v9-20261025", "native-gui-font-pack-cross-v10-20261025", "native-gui-font-pack-text-cross-v11-20261025"]) {
      const probe = JSON.parse(readFileSync(root + "docs/parity/evidence/original/" + folder + "/mask-alignment-analysis.json", "utf8")) as {
        samples: Array<{size: number; text: string; rect: number[]; baseline: number}>};
      for (const sample of probe.samples) {
        expect(nativeGuiBaselines(sample.text, sample.size, {y: sample.rect[1]!, height: sample.rect[3]!})!.at(-1)).toBe(sample.baseline);
        count++;
      }
    }
    expect(count).toBe(66);
  });
  it("matches54 native Move pens while retaining all12 Undo falsifications as unsupported", () => {
    let supported = 0, unsupported = 0;
    for (const folder of ["native-gui-font-pack-v7-20261025", "native-gui-font-pack-odd-v8-20261025", "native-gui-font-pack-falsify-v9-20261025", "native-gui-font-pack-cross-v10-20261025", "native-gui-font-pack-text-cross-v11-20261025"]) {
      const probe = JSON.parse(readFileSync(root + "docs/parity/evidence/original/" + folder + "/mask-alignment-analysis.json", "utf8")) as {
        samples: Array<{size: number; text: string; rect: number[]; baseline: number; penX: number}>};
      for (const sample of probe.samples) {
        const [x, y, width, height] = sample.rect as [number, number, number, number];
        const generic = nativeCaptionQuads(sample.text, sample.size, {x, y, width, height})!;
        const firstCharacter = sample.text.replaceAll("\n", "")[0]!;
        const firstGlyph = nativeFontSizes[sample.size]!.glyphs[firstCharacter]!;
        expect(generic[0]!.x - firstGlyph.bounds[0]!).toBe(sample.penX);
        expect(generic[0]!.y + firstGlyph.bounds[3]!).toBe(sample.baseline);
        const quads = nativeMoveCaptionQuads(sample.text, sample.size, {x, y, width, height});
        if (sample.text.includes("Undo")) { expect(quads).toBeNull(); unsupported++; continue; }
        const glyph = nativeFontSizes[sample.size]!.glyphs.M!;
        expect(quads![0]!.x - glyph.bounds[0]!).toBe(sample.penX);
        expect(quads![0]!.y + glyph.bounds[3]!).toBe(sample.baseline);
        supported++;
      }
    }
    expect([supported, unsupported]).toEqual([54, 12]);
  });
  it.each([[12, 55.5, 600, 369], [16, 66.8224945, 733, 451], [20, 72.4, 720, 453]])(
    "matches actual tutorial baseline atfont%i", (size, y, height, baseline) => {
      expect(nativeGuiBaselines("\nMove", size!, {y: y!, height: height!})![1]).toBe(baseline);
    },
  );
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
