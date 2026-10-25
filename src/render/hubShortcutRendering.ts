import { FloorType, type Block, type Floor, type HsvColor } from "../core/model";
import { puzzleMetadata } from "../core/progression";
import type { HubLineRect, HubPortalGeometry } from "./hubPortalRendering";
import { nativeCaptionQuads, type NativeGlyphQuad } from "./nativeFontRendering";

/** Raw Unity Color passed to GUI/DrawTexture, before GUI byte conversion. */
export interface HubCaptionGuiColor {
  readonly r: number; readonly g: number; readonly b: number; readonly a: number;
}
export interface HubCaptionDraw {
  readonly text: string;
  readonly fontSize: number;
  readonly alignment: "MiddleCenter";
  readonly rect: HubLineRect;
  readonly guiColor: HubCaptionGuiColor;
  /** Null means the captured atlas cannot render this exact source request. */
  readonly glyphs: readonly NativeGlyphQuad[] | null;
}
export interface HubShortcutCounts {
  readonly numRequired: number;
  readonly numSolved: number;
  readonly numSolvedUncapped: number;
}
export interface HubShortcutProgress {
  readonly unlockAllPuzzles?: boolean;
  /** SaveFile.LevelWon.Count, including wins absent from visible Hub floors. */
  readonly totalWon?: number;
  /** Defaults to the canonical Hub puzzle metadata count. */
  readonly totalPuzzles?: number;
}
export interface HubShortcutDrawState {
  readonly counting?: boolean;
  readonly countingDelta?: number;
  readonly countingScaleT?: number;
  readonly unlocking?: boolean;
  readonly unlockingT?: number;
  readonly unlockingLength?: number;
}
export interface HubShortcutFraction {
  /** The same counting-pop dimensions must be used for the wall body. */
  readonly geometry: HubPortalGeometry;
  readonly numerator: HubCaptionDraw;
  readonly denominator: HubCaptionDraw;
  readonly bar: {readonly rect: HubLineRect; readonly guiColor: HubCaptionGuiColor};
}

/** LoadLevel's static initialization; no counts are inferred for special clears. */
export function hubShortcutCounts(
  block: Pick<Block, "outerLevel" | "subLevel" | "unlockerScene">,
  progress: HubShortcutProgress = {},
): HubShortcutCounts | null {
  const { outerLevel: level, unlockerScene: unlocker } = block;
  if (!level || block.subLevel || unlocker === null || unlocker === "*clear" || unlocker === "*clear_or_unlock_all") return null;
  if (unlocker === "*all") {
    if (progress.totalWon === undefined) return null;
    return {numRequired: progress.totalPuzzles ?? puzzleMetadata.size, numSolved: progress.totalWon, numSolvedUncapped: 0};
  }
  if (progress.unlockAllPuzzles) return null;
  let required = 0, won = 0;
  for (const floor of level.floorList) {
    if (floor.type !== FloorType.LevelPortal) continue;
    const metadata = puzzleMetadata.get(floor.sceneName);
    if (!metadata) throw new Error("Missing Hub puzzle metadata " + floor.sceneName);
    if (metadata.hard === 0) required++;
    if (floor.won) won++;
  }
  if (level.hubAreaName === "Area_Swap" || level.hubAreaName === "Area_Wall") required--;
  return {numRequired: required, numSolved: Math.min(won, required), numSolvedUncapped: won};
}

/** Retained route records do not make a removed wall a drawable object. */
export function isHubShortcutWallPresent(block: Block): boolean {
  return !block.subLevel && block.unlockerScene !== null && block.outerLevel !== null
    && block.outerLevel.getBlock(block.x, block.y) === block;
}

function drawRect(x: number, y: number, width: number, height: number): HubLineRect {
  const left = Math.trunc(x) || 0, top = Math.trunc(y) || 0;
  return {x: Math.fround(left), y: Math.fround(top), width: Math.fround((Math.trunc(x + width) || 0) - left),
    height: Math.fround((Math.trunc(y + height) || 0) - top)};
}

function caption(text: string, fontSize: number, rect: HubLineRect, guiColor: HubCaptionGuiColor): HubCaptionDraw {
  return {text, fontSize, alignment: "MiddleCenter", rect, guiColor, glyphs: nativeCaptionQuads(text, fontSize, rect)};
}

function lerp(a: number, b: number, t: number): number {
  const f = Math.fround;
  return f(f(a) + f(f(f(b) - f(a)) * Math.max(0, Math.min(1, f(t)))));
}

/** DrawWall's double dimensions multiplied by its float32 counting pop. */
export function hubShortcutWallGeometry(geometry: HubPortalGeometry, countingScaleT = 0): HubPortalGeometry {
  const f = Math.fround, k = f(countingScaleT);
  if (k === 0) return {...geometry};
  const scale = lerp(1, 1.5, f(k * k));
  return {...geometry, width: geometry.width * scale, height: geometry.height * scale};
}

/** DrawWall body multiplier; keep HDR channels until after texture sampling. */
export function hubShortcutBodyBrightness(state: HubShortcutDrawState = {}): number {
  return state.unlocking ? lerp(1, Math.fround(1.65),
    Math.fround(Math.fround(state.unlockingT ?? 0) / Math.fround(state.unlockingLength ?? 1.75))) : 1;
}

/** Color.HSVToRGB's clamped channels, before HSVToRGBGUI divides by two. */
function hsvChannels({h, s, v}: HsvColor): readonly number[] {
  const f = Math.fround;
  h = f(h); s = f(s); v = f(v);
  if (s === 0) return [v, v, v].map(value => Math.max(0, Math.min(1, value)));
  const hue = f(h * 6), sector = Math.floor(hue), fraction = f(hue - sector);
  const p = f(v * f(1 - s)), q = f(v * f(1 - f(s * fraction))),
    t = f(v * f(1 - f(s * f(1 - fraction))));
  const channels = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][((sector % 6) + 6) % 6]!;
  return channels.map(value => Math.max(0, Math.min(1, value)));
}

/** Raw inactive LineColor, then DrawWall's fraction/unlock multipliers. */
export function hubShortcutFractionColor(
  parentColor: HsvColor, parentWidth: number, parentHeight: number, screenHeight: number,
  state: HubShortcutDrawState = {}, hueOffset = 0,
): HubCaptionGuiColor {
  const f = Math.fround, fraction = f((parentWidth + parentHeight) / 2 / screenHeight);
  const logarithm = f(Math.log(fraction) / Math.log(20));
  let value = f(Math.max(f(parentColor.v), f(.4)) * f(f(f(-.4) * logarithm) + f(.8)));
  value = f(value * f(.25));
  const channels = hsvChannels({h: f(f(parentColor.h) + f(hueOffset)) % 1, s: f(parentColor.s), v: value});
  const unlockScale = state.unlocking
    ? lerp(1.5, 6, f(f(state.unlockingT ?? 0) / f(state.unlockingLength ?? 1.75))) : 1;
  const [r, g, b] = channels.map(channel => f(f(f(channel / 2) * f(1.25)) * unlockScale));
  return {r: r!, g: g!, b: b!, a: 1};
}

/** DrawWall captions/bar only; this helper neither draws nor advances state. */
export function hubShortcutFraction(
  block: Block, geometry: HubPortalGeometry, screenHeight: number,
  options: {readonly counts?: HubShortcutCounts; readonly progress?: HubShortcutProgress;
    readonly state?: HubShortcutDrawState; readonly hueOffset?: number} = {},
): HubShortcutFraction | null {
  if (!isHubShortcutWallPresent(block)) return null;
  const counts = options.counts ?? hubShortcutCounts(block, options.progress);
  if (!counts || counts.numRequired === 0) return null;
  const state = options.state ?? {}, level = block.outerLevel!;
  const popped = hubShortcutWallGeometry(geometry, state.countingScaleT);
  const {centerX: x, centerY: y, width: w, height: h} = popped;
  const color = hubShortcutFractionColor(level.getExitBlock().color, w * level.width, h * level.height,
    screenHeight, state, options.hueOffset);
  const fontSize = Math.trunc(h * Math.fround(.42));
  const numerator = counts.numSolved - (state.counting ? state.countingDelta ?? 0 : 0);
  const offset = h * Math.fround(.26), barW = w * Math.fround(.6), barH = h * Math.fround(.05);
  return {geometry: popped,
    numerator: caption(String(numerator), fontSize, drawRect(x - w, y - h - offset, w * 2, h * 2), color),
    denominator: caption(String(counts.numRequired), fontSize, drawRect(x - w, y - h + offset, w * 2, h * 2), color),
    bar: {rect: drawRect(x - barW * .5, y - barH * .5, barW, barH),
      guiColor: {r: Math.fround(color.r * .5), g: Math.fround(color.g * .5), b: Math.fround(color.b * .5), a: 1}}};
}

/** DrawPortal expands its full float32 cell before drawing any paused label. */
export function hubPortalCelebrationGeometry(geometry: HubPortalGeometry, celebrationSizeT = 0): HubPortalGeometry {
  const f = Math.fround;
  let width = f(geometry.width), height = f(geometry.height);
  if (f(celebrationSizeT) > 0) {
    const k = f(Math.min(f(f(celebrationSizeT) * 2), 1) - 1);
    const scale = f(1 + f(f(.5) * f(k * k)));
    width = f(width * scale); height = f(height * scale);
  }
  return {centerX: f(geometry.centerX), centerY: f(geometry.centerY), width, height};
}

/** DrawPortal's black shadow then white reference, with original float Rect edits. */
export function hubPausedPortalReference(
  floor: Pick<Floor, "type" | "sceneName" | "unlocked">, geometry: HubPortalGeometry,
  options: {readonly paused: boolean; readonly inBreakMenu?: boolean; readonly celebrationSizeT?: number},
): {readonly geometry: HubPortalGeometry; readonly shadow: HubCaptionDraw; readonly foreground: HubCaptionDraw} | null {
  if (floor.type !== FloorType.LevelPortal || !options.paused || options.inBreakMenu || !floor.unlocked) return null;
  const expanded = hubPortalCelebrationGeometry(geometry, options.celebrationSizeT);
  const {centerX: x, centerY: y, width: w, height: h} = expanded, f = Math.fround;
  if (!(w > 10 && h > 10)) return null;
  const metadata = puzzleMetadata.get(floor.sceneName);
  if (!metadata) throw new Error("Missing Hub puzzle metadata " + floor.sceneName);
  const rect = drawRect(f(x - w), f(y - h), f(w * 2), f(h * 2));
  const dx = f(w * f(.06)), dy = f(h * f(.06)), fontSize = Math.trunc(f(h * f(.55)));
  const shadowRect = {...rect, x: f(rect.x + dx), y: f(rect.y + dy)};
  const foregroundRect = {...rect, x: f(shadowRect.x - dx), y: f(shadowRect.y - dy)};
  return {geometry: expanded,
    shadow: caption(metadata.referenceName, fontSize, shadowRect, {r: 0, g: 0, b: 0, a: 1}),
    foreground: caption(metadata.referenceName, fontSize, foregroundRect, {r: 1, g: 1, b: 1, a: 1})};
}
