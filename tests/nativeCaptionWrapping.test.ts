/// <reference types="node" />
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import tutorial from "../docs/parity/evidence/original/intro-third-tutorial-native-derived.json";
import { nativeAsciiWordWrap, nativeNoteCaptionRect, nativeWrappedCaptionQuads } from "../src/render/nativeCaptionWrapping";
import { nativeCaptionQuads, nativeFontSizes, nativeGuiBaselines, nativeTextWidth, type NativeGlyphQuad } from "../src/render/nativeFontRendering";
import { readRgbaPng } from "./helpers/readRgbaPng";

const note = "Note: You can undo a reset";
const root = fileURLToPath(new URL("../", import.meta.url));
const atlas = readRgbaPng(root + "src/assets/fonts/native-jost-atlas.png");

/** Raw original glyph alpha threshold, not a fitted text/background compositor. */
function inkBounds(quads: readonly NativeGlyphQuad[]): number[] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const glyph of quads) {
    const [sx, sy, width, height] = glyph.frame;
    for (let y = 0; y < height!; y++) for (let x = 0; x < width!; x++) {
      const alpha = atlas.pixels[((sy! + y) * atlas.width + sx! + x) * 4 + 3]!;
      if (alpha <= 150) continue;
      x0 = Math.min(x0, glyph.x + x); y0 = Math.min(y0, glyph.y + y);
      x1 = Math.max(x1, glyph.x + x + 1); y1 = Math.max(y1, glyph.y + y + 1);
    }
  }
  return [x0, y0, x1, y1];
}

describe("bounded native ASCII space wrapping", () => {
  it.each([[12, 90, 80, 112, 70], [16, 109, 104, 146, 91], [20, 158, 130, 182, 113]])(
    "wraps the real Note from measured advances at%ipx", (size, width, first, tooLong, second) => {
      expect(nativeTextWidth("Note: You can", size!)).toBe(first);
      expect(nativeTextWidth("Note: You can undo", size!)).toBe(tooLong);
      expect(nativeTextWidth("undo a reset", size!)).toBe(second);
      expect(nativeAsciiWordWrap(note, size!, width!)).toBe("Note: You can\nundo a reset");
    },
  );

  it("selects breaks from width rather than a hardcoded Note phrase", () => {
    expect(nativeAsciiWordWrap(note, 12, 154)).toBe(note);
    expect(nativeAsciiWordWrap(note, 12, 112)).toBe("Note: You can undo\na reset");
    expect(nativeAsciiWordWrap("Undo Redo Menu", 16, 80)).toBe("Undo\nRedo\nMenu");
    expect(nativeAsciiWordWrap("Undo Redo Menu", 16, 200)).toBe("Undo Redo Menu");
  });

  it("keeps explicit newlines and empty lines in native baseline order", () => {
    expect(nativeAsciiWordWrap("\nMove", 16, 40)).toBe("\nMove");
    expect(nativeAsciiWordWrap("Undo\n\nMenu\n", 16, 100)).toBe("Undo\n\nMenu\n");
    expect(nativeAsciiWordWrap("", 16, 100)).toBe("");
    const rect = {x: 0, y: 0, width: 100, height: 100};
    expect(nativeWrappedCaptionQuads("\nMove", 16, rect)).toEqual(nativeCaptionQuads("\nMove", 16, rect));
  });

  it("leaves unmeasured whitespace, token splitting, markup and fonts unsupported", () => {
    for (const text of [" Move", "Move ", "Move  Undo", "Move\tUndo", "Move\r\nUndo", "<b>Move</b>", "移动"]) {
      expect(nativeAsciiWordWrap(text, 16, 100)).toBeNull();
    }
    expect(nativeAsciiWordWrap("Move", 13, 100)).toBeNull();
    expect(nativeAsciiWordWrap("Move", 16, 39)).toBeNull();
    for (const width of [0, -1, 90.5, NaN, Infinity]) expect(nativeAsciiWordWrap(note, 12, width)).toBeNull();
    expect(nativeWrappedCaptionQuads(note, 12, {x: 0.25, y: 0, width: 90, height: 180})).toBeNull();
  });
});

describe("source Note rectangle and original multiline layout", () => {
  it("matches all three independently derived actual tutorial viewports", () => {
    expect(tutorial.captures).toHaveLength(3);
    const expectedBaselines = [[476, 493], [579, 602], [600, 629]];
    for (const [index, capture] of tutorial.captures.entries()) {
      const geometry = capture.geometrySourceDerived;
      const row = geometry.rows.at(-1)!;
      const [width, height] = capture.actualScreen;
      const rect = nativeNoteCaptionRect(row.xCenter, row.yCenter, width!, height!);
      expect([rect.x, rect.y, rect.width, rect.height]).toEqual(row.captionGuiRect);
      const wrapped = nativeAsciiWordWrap(note, geometry.fontSize, rect.width)!;
      expect(wrapped.split("\n")).toEqual(row.visibleLines);
      expect(nativeGuiBaselines(wrapped, geometry.fontSize, rect)).toEqual(expectedBaselines[index]);
      const quads = nativeWrappedCaptionQuads(note, geometry.fontSize, rect)!;
      expect(quads).toEqual(nativeCaptionQuads(wrapped, geometry.fontSize, rect));
      expect(nativeFontSizes[geometry.fontSize]!.lineHeight).toBe([17, 23, 29][index]);
      const line1 = quads.slice(0, wrapped.split("\n")[0]!.length);
      const line2 = quads.slice(line1.length);
      const actual = capture.noteInkMeasurement.lineInkBounds;
      if (geometry.fontSize === 20) {
        // Raw-alpha threshold and real-background threshold differ here.
        // Gray void square78 underneath unchanged N alpha115 produces158.
        expect(inkBounds(line1)).toEqual([116, 586, 243, 600]);
        expect(actual[0]).toEqual([115, 586, 243, 600]);
        const image = readRgbaPng(root + "docs/parity/evidence/original/" + capture.id + "/" + capture.settledFrame.file);
        expect(Array.from(image.pixels.subarray((586 * image.width + 115) * 4, (586 * image.width + 115) * 4 + 3))).toEqual([158, 158, 158]);
        const background = image.pixels[(586 * image.width + 114) * 4]!;
        expect(background).toBe(78);
        const glyph = nativeFontSizes[20]!.glyphs.N!;
        const alpha = atlas.pixels[((glyph.frame[1]! + 2) * atlas.width + glyph.frame[0]! + 1) * 4 + 3]!;
        expect(alpha).toBe(115);
        expect(Math.round(alpha + background * (1-alpha/255))).toBe(158);
      } else expect(inkBounds(line1)).toEqual(actual[0]);
      expect(inkBounds(line2)).toEqual(actual[1]);
    }
  });

  it("truncates endpoints rather than width independently at negative origins", () => {
    // Float32 short-edge*.15 gives90. The interval[-44.75,45.25) truncates to[-44,45).
    expect(nativeNoteCaptionRect(0.25, 0.25, 800, 600)).toEqual({x: -44, y: -89, width: 89, height: 179});
  });
});
