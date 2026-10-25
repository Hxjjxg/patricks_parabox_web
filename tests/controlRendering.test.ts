import { describe, expect, it } from "vitest";
import { GameRenderer } from "../src/render/GameRenderer";
import { controlTutorial } from "../src/render/controlRendering";
import { controlCaptionRect } from "../src/render/controlRendering";
import { nativeMoveCaptionQuads } from "../src/render/nativeFontRendering";
import {nativeWrappedCaptionQuads} from '../src/render/nativeCaptionWrapping';
import { Texture, TextureSource } from "pixi.js";

function renderControls(levelName: string, width: number, height: number, moveCount = 0, leftHanded = false, emptySave = false, nativeAtlas = false) {
  const positions: number[][] = [];
  const icons: number[][] = [];
  const children: unknown[] = [];
  const controls = { visible: false, alpha: 0, position: { set: (...xy: number[]) => positions.push(xy) }, addChild: (child: unknown) => children.push(child) };
  const graphics = {
    clear: () => graphics,
    rect: (...rect: number[]) => { icons.push(rect); return graphics; },
    fill: () => graphics,
  };
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: { screen: { width, height } },
    controls, controlGraphics: graphics, controlLabels: [], controlGlyphs: [], controlGlyphTextures: new Map(),
    textures: { arrowKeys: {}, wasd: {}, nativeJostAtlas: nativeAtlas ? new Texture({source: new TextureSource({width: 512, height: 512})}) : undefined },
    world: { levelName },
    uiState: { mode: "playing", preferences: { leftHanded },
      controls: { emptySave, fromIntro: false, fadeT: 0, secondPuzzleWon: false } },
  });
  const size = Math.min(width, height) * 0.82;
  receiver.drawControls((width - size) / 2, (height - size) / 2, size, size, moveCount, width);
  return { controls, positions, icons, receiver, children };
}

describe("native Move tutorial visibility and placement", () => {
  it('preserves text fallback when the physical Note font has not been captured', () => {
    const {receiver} = renderControls('third_puzzle', 600, 401, 0, false, false, true);
    receiver.uiState.controls.fromIntro = true;
    const labels = Array.from({length: 5}, () => ({visible: false, style: {}, position: {set() {}}}));
    receiver.controlLabels = labels;
    receiver.drawControls(100, 30, 330, 330, 0, 600);
    expect(receiver.controlGlyphs).toHaveLength(0);
    expect(labels[4]).toMatchObject({visible: true, text: 'Note: You can undo a reset', style: {wordWrap: true}});
  });
  it("uses native atlas sprites for the four intro captions and source-wrapped Note", () => {
    const { receiver, children } = renderControls("third_puzzle", 800, 600, 0, false, false, true);
    receiver.uiState.controls.fromIntro = true;
    const labels = Array.from({length: 5}, () => ({visible: false, style: {}, position: {set: () => {}}}));
    receiver.controlLabels = labels;
    receiver.drawControls(154, 54, 492, 492, 0, 800);
    // Native CharacterInfo advances/frames supply Undo, Redo, Reset puzzle, Menu.
    const note = nativeWrappedCaptionQuads('Note: You can undo a reset', 12, {x: 32, y: 390, width: 90, height: 180})!;
    expect(receiver.controlGlyphs).toHaveLength(24 + note.length);
    expect(labels.every(label => !label.visible)).toBe(true);
    const origin = controlTutorial('third_puzzle', 800, 600, {x: 154, y: 54, width: 492, height: 492}, receiver.uiState.controls).x;
    expect(receiver.controlGlyphs.slice(24).map((sprite: {x: number; y: number}) => [sprite.x, sprite.y]))
      .toEqual(note.map(quad => [quad.x - origin, quad.y]));
    receiver.drawControls(154, 54, 492, 492, 0, 800);
    expect(children).toHaveLength(24 + note.length);
  });
  it("uses exact atlas UV frames through four reusable sprites rather than Graphics full-source fills", () => {
    const { receiver, children, positions } = renderControls("first_puzzle", 800, 600, 0, false, false, true);
    expect(receiver.controlGlyphs).toHaveLength(4);
    expect(receiver.controlGlyphs.map((glyph: {x: number; y: number; texture: Texture}) => [glyph.x + positions[0]![0]!, glyph.y, glyph.texture.frame.width, glyph.texture.frame.height])).toEqual([
      [61, 359, 12, 11], [71, 362, 9, 9], [77, 362, 10, 9], [84, 362, 9, 9],
    ]);
    receiver.drawControls(154, 54, 492, 492, 0, 800);
    expect(children).toHaveLength(4);
    expect(receiver.controlGlyphTextures.size).toBe(4);
  });
  it.each([
    [800, 600, 55.5, -223, 600, 62, 369],
    [1001, 733, 66.8225, -266, 732, 80, 451],
    [1280, 720, 72.4, -180, 719, 154, 453],
  ])("uses native pre-icon endpoint snapping and actual glyph placement at%ix%i", (width, height, expectedY, expectedX, expectedWidth, pen, baseline) => {
    const minimum = Math.min(width!, height!);
    const size = minimum * .82;
    const tutorial = controlTutorial("first_puzzle", width!, height!, {x: (width! - size) / 2, y: (height! - size) / 2, width: size, height: size});
    const action = tutorial.actions[1]!;
    const rect = controlCaptionRect(tutorial.x, action.y, minimum, minimum * .13, 1);
    expect(rect.x).toBe(expectedX);
    expect(rect.width).toBe(expectedWidth);
    expect(rect.y).toBeCloseTo(expectedY!, 5);
    const quad = nativeMoveCaptionQuads("\nMove", tutorial.fontSize, rect)![0]!;
    expect(quad.x).toBe(pen! - 1);
    expect(quad.y).toBe(baseline! - [10, 13, 16][[12, 16, 20].indexOf(tutorial.fontSize)]!);
  });
  it.each([[800, 600, 12], [1001, 733, 16], [1280, 720, 20]])("uses aspect-dependent native font size at%ix%i", (width, height, expected) => {
    expect(controlTutorial("first_puzzle", width!, height!, { x: 154, y: 54, width: 492, height: 492 }).fontSize).toBe(expected);
  });
  it("stages second-puzzle intro actions with the native1+2.5i fade delays", () => {
    const state = { emptySave: false, fromIntro: true, fadeT: 4, secondPuzzleWon: false };
    const tutorial = controlTutorial("second_puzzle", 800, 600, { x: 154, y: 54, width: 492, height: 492 }, state);
    expect(tutorial.actions.map(({ label }) => label)).toEqual(["Undo", "Redo", "Reset puzzle", "Menu", "Note: You can undo a reset"]);
    expect(tutorial.actions.map(({ alpha }) => alpha)).toEqual([1, 0.5, 0, 0, 0]);
    expect(controlTutorial("third_puzzle", 800, 600, { x: 154, y: 54, width: 492, height: 492 }, state).actions.map(({ alpha }) => alpha)).toEqual([1, 1, 1, 1, 1]);
    expect(controlTutorial("second_puzzle", 800, 600, { x: 154, y: 54, width: 492, height: 492 }, { ...state, secondPuzzleWon: true }).actions.map(({ alpha }) => alpha)).toEqual([1, 1, 1, 1, 1]);
  });

  it.each(["squash_inside_3", "eat_4_sides", "eat_long_line"])("shows native mouse inspection instruction on%s", (levelName) => {
    expect(controlTutorial(levelName, 800, 600, { x: 154, y: 54, width: 492, height: 492 }).actions.map(({ texture }) => texture)).toEqual(["mouseZoom"]);
  });

  it("shows first-puzzle Move controls at 800x600", () => {
    const { controls, positions } = renderControls("first_puzzle", 800, 600);
    expect(controls.visible).toBe(true);
    expect(positions[0]![0]).toBeCloseTo(77, 8);
    expect(positions[0]![1]).toBe(0);
  });

  it.each(["second_puzzle", "third_puzzle", "enter"])("does not invent a Move tutorial on %s", (level) => {
    expect(renderControls(level, 1280, 720).controls.visible).toBe(false);
  });

  it("keeps Move fully visible after first-puzzle movement", () => {
    expect(renderControls("first_puzzle", 1280, 720, 5).controls.alpha).toBe(1);
  });

  it("uses screen-space placement below native aspect1.51 and integer half-height", () => {
    const { positions, icons } = renderControls("first_puzzle", 1001, 733);
    expect(positions[0]![0]).toBeCloseTo((1001 - 733 * 0.82) / 4, 6);
    expect(icons[0]![1]).toBe(Math.trunc(366 - 733 * 0.15 * 0.4 - 733 * 0.13 * 0.75));
  });

  it("retains wide-screen world placement regardless of touch-handedness", () => {
    const a = renderControls("first_puzzle", 1280, 720, 0, false);
    const b = renderControls("first_puzzle", 1280, 720, 0, true);
    expect(a.positions).toEqual(b.positions);
    expect(a.positions[0]![0]).toBeCloseTo((1280 - 720 * 0.82) / 2 - 720 * 0.82 * 0.28, 6);
  });

  it("shows Move in the hub only for an empty native save", () => {
    expect(renderControls("hub", 1280, 720, 0, false, false).controls.visible).toBe(false);
    expect(renderControls("hub", 1280, 720, 0, false, true).controls.visible).toBe(true);
  });
});
