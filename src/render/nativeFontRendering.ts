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

/**
 * The staged horizontal rule has been independently verified for Move only.
 * Undo falsifies it; callers must keep other captions on the existing path
 * until their native GUI alignment is understood, rather than fit an offset.
 */
export function nativeMoveCaptionQuads(
  text: string, fontSize: number, rect: {x: number; y: number; width: number; height: number},
): NativeGlyphQuad[] | null {
  if (text !== "Move" && text !== "\nMove") return null;
  const baselines = nativeGuiBaselines(text, fontSize, rect);
  const width = nativeTextWidth("Move", fontSize);
  if (!baselines || width === null) return null;
  const pen = Math.ceil(rect.x - .5) + Math.ceil((rect.width - width) / 2 - .5);
  return nativeGlyphQuads("Move", fontSize, pen, baselines.at(-1)!);
}
