import fontData from "../assets/data/native-font-metrics.json";

export interface NativeGlyph {
  readonly advance: number;
  readonly bounds: readonly number[];
  readonly frame: readonly number[];
}
export interface NativeFontSize {
  readonly lineHeight: number;
  readonly singleLineHeight: number;
  readonly hintedAscent: number;
  readonly glyphs: Readonly<Record<string, NativeGlyph>>;
}
export interface NativeGlyphQuad {
  readonly character: string;
  readonly frame: readonly number[];
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export const nativeFontSizes: Readonly<Record<string, NativeFontSize>> = fontData.sizes;

/** Native GUI clips and aligns the text in separate pixel-snapping stages. */
export function nativeGuiBaselines(
  text: string, fontSize: number, rect: {y: number; height: number},
): number[] | null {
  const font = nativeFontSizes[fontSize];
  if (!font) return null;
  const count = text.split("\n").length;
  const height = font.singleLineHeight + (count - 1) * font.lineHeight;
  const top = (rect.height - height) / 2 + fontData.padding[2]!;
  const origin = Math.floor(rect.y + 0.5);
  return Array.from({length: count}, (_, line) =>
    origin + Math.floor(top + line * font.lineHeight + font.hintedAscent + 0.5));
}

/** Native CharacterInfo.advance, with no Canvas shaping or letter spacing. */
export function nativeTextWidth(text: string, fontSize: number): number | null {
  const font = nativeFontSizes[fontSize];
  if (!font) return null;
  let width = 0;
  for (const character of text) {
    const glyph = font.glyphs[character];
    if (!glyph) return null;
    width += glyph.advance;
  }
  return width;
}

/**
 * One baseline-aligned line of original glyphs. GUIStyle placement is supplied
 * separately; do not infer a baseline from Canvas metrics or atlas dimensions.
 */
export function nativeGlyphQuads(
  text: string, fontSize: number, penX: number, baseline: number,
): NativeGlyphQuad[] | null {
  const font = nativeFontSizes[fontSize];
  if (!font || nativeTextWidth(text, fontSize) === null) return null;
  const result: NativeGlyphQuad[] = [];
  for (const character of text) {
    const glyph = font.glyphs[character]!;
    const [left, , , top] = glyph.bounds;
    const [, , width, height] = glyph.frame;
    result.push({ character, frame: glyph.frame, x: penX + left!, y: baseline - top!,
      width: width!, height: height! });
    penX += glyph.advance;
  }
  return result;
}

export type NativeHorizontalAlignment = "MiddleCenter" | "UpperLeft";

// UnityPlayer 0x1806145f0 uses floor(physicalPixel + 0.48f). This is the
// untransformed, unit-scale horizontal GUI path retained by our native probes.
const nativeGuiSnapX = (x: number): number => Math.floor(x + Math.fround(.48));

function nativeGuiAnchorX(
  textWidth: number, rect: {x: number; width: number}, alignment: NativeHorizontalAlignment,
): number {
  const factor = alignment === "MiddleCenter" ? .5 : 0;
  const left = nativeGuiSnapX(rect.x);
  const width = nativeGuiSnapX(rect.x + rect.width) - left;
  // GUIStyle aligns the text rect, snaps its endpoints, then recenters the
  // render anchor inside that snapped rect and snaps the anchor once more.
  const textX = left + (width - textWidth) * factor;
  const textLeft = nativeGuiSnapX(textX);
  const textExtent = nativeGuiSnapX(textX + textWidth) - textLeft;
  return nativeGuiSnapX(textLeft + textExtent * factor);
}

/** Original GUI draw stages; the exposed GUI cursor follows a separate path. */
export function nativeGuiPenX(
  advance: number, rect: {x: number; width: number},
  alignment: NativeHorizontalAlignment = "MiddleCenter",
): number {
  const anchor = nativeGuiAnchorX(advance, rect, alignment);
  // 0x180c76e60 shifts every centered vertex and cursor by the negative
  // rounded line midpoint. 0x180c7b3d0 uses floor(scale*x + .5)/scale.
  return anchor - (alignment === "MiddleCenter" ? Math.floor(advance / 2 + .5) : 0);
}

/**
 * Plain, unwrapped MiddleCenter captions from the captured native atlas.
 * Local line origins and the shared render anchor follow Unity's native
 * generator/GUIStyle stages; signed glyph bearings remain independent.
 */
export function nativeCaptionQuads(
  text: string, fontSize: number, rect: {x: number; y: number; width: number; height: number},
): NativeGlyphQuad[] | null {
  // Native richText/wordWrap need separate shaping; retain the caller fallback.
  if (text.includes("<") || text.includes(">")) return null;
  const lines = text.split("\n");
  const widths = lines.map(line => nativeTextWidth(line, fontSize));
  if (widths.some(width => width === null)) return null;
  const baselines = nativeGuiBaselines(text, fontSize, rect);
  if (!baselines) return null;
  const textWidth = Math.max(...widths as number[]);
  const available = nativeGuiSnapX(rect.x + rect.width) - nativeGuiSnapX(rect.x);
  if (textWidth > available) return null;
  const anchor = nativeGuiAnchorX(textWidth, rect, "MiddleCenter");
  return lines.flatMap((line, index) => nativeGlyphQuads(
    line, fontSize, anchor - Math.floor(widths[index]! / 2 + .5), baselines[index]!,
  )!);
}

/** Compatibility entry point for the already-validated Move tutorial. */
export function nativeMoveCaptionQuads(
  text: string, fontSize: number, rect: {x: number; y: number; width: number; height: number},
): NativeGlyphQuad[] | null {
  if (text !== "Move" && text !== "\nMove") return null;
  return nativeCaptionQuads(text, fontSize, rect);
}
