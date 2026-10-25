import {describe, expect, it} from "vitest";
import {Container, Texture, TextureSource} from "pixi.js";
import hubSource from "../src/assets/levels/hub.txt?raw";
import {parseLevel} from "../src/core/levelParser";
import {spawnHubCelebrationEdgeParticles} from "../src/core/hubCelebrationParticles";
import {DrawStyle, FloorType} from "../src/core/model";
import {ProgressionModel} from "../src/core/progression";
import {GameRenderer} from "../src/render/GameRenderer";
import {hubPausedPortalReference, hubPortalCelebrationGeometry, hubShortcutBodyBrightness,
  hubShortcutFraction, hubShortcutWallGeometry, type HubCaptionDraw} from "../src/render/hubShortcutRendering";
import {originalDrawRect, wallTint} from "../src/render/wallRendering";

type Rect = {x: number; y: number; width: number; height: number};
type Event = {kind: string; [key: string]: any};
const physical = (rect: Rect, r: number) => ({centerX: (rect.x + rect.width / 2) * r,
  centerY: (rect.y + rect.height / 2) * r, width: rect.width * r, height: rect.height * r});
const logical = (cell: ReturnType<typeof physical>, r: number) => ({x: (cell.centerX - cell.width / 2) / r,
  y: (cell.centerY - cell.height / 2) / r, width: cell.width / r, height: cell.height / r});
function fixture(resolution = 1) {
  const world = parseLevel(hubSource, "hub"); new ProgressionModel({wonLevels: ["third_puzzle"]}).applyToHub(world);
  const level = world.levels.find(level => level.hubAreaName === "Area_Intro")!;
  const wall = world.hubUnlockWalls.find(block => block.outerLevel === level && block.unlockerScene === "lock_door")!;
  const floor = level.floorList.find(floor => floor.sceneName === "first_puzzle")!;
  const events: Event[] = []; let layer = 0;
  function graphics(kind: string, tint?: Float32Array): any {
    const data: any = {kind, tint, layer: layer++, clip: receiver.activeSceneContainer?.clip ?? null}; let rect: number[] = [];
    const g: any = new Proxy(data, {get: (object, key) => {
      if (key in object) return object[key];
      if (key === "rect") return (...values: number[]) => {rect = values; return g;};
      if (key === "fill") return (style: any) => {events.push({kind: "fill", rect, style, g}); return g;};
      if (key === "texture") return (texture: any, color: any, ...values: number[]) => {events.push({kind: "texture", texture, color, rect: values, g}); return g;};
      return () => g;
    }}); return g;
  }
  const receiver: any = Object.assign(Object.create(GameRenderer.prototype), {world,
    app: {screen: {width: 800, height: 600}, renderer: {resolution}}, scene: new Container(),
    uiState: {mode: "paused", special: {mode: "none"}, preferences: {disableParticles: true}}, elapsed: 0,
    textures: {centerGradient: Texture.WHITE, quickBlock: Texture.WHITE, walls: [], wallsFlip: [], wallsBig: [], wallsBigFlip: [],
      portalThumbnails: {}, nativeJostAtlas: new Texture({source: new TextureSource({width: 2048, height: 2048})})},
    controlGlyphTextures: new Map(),
    activeSceneContainer: {clip: null}, maskedScene: (clip: Rect | null) => ({clip}),
    nextSceneLayer: () => graphics("scene"), nextWallLayer: (tint: Float32Array) => graphics("wall", tint),
    drawHubConnections() {}, drawInfEffect() {}, pendingTickets: [], portalMarkerTickets: [], effectTickets: [],
  });
  const recordCaption = (caption: HubCaptionDraw, r: number) => {
    const g = receiver.nextSceneLayer(); events.push({kind: "caption", caption, resolution: r, g});
    return caption.glyphs !== null;
  };
  return {world, level, wall, floor, receiver, events, graphics, recordCaption, resolution};
}

describe("source-based live Hub caption renderer integration; no visual approval", () => {
  it.each([1, 2])("drawHubCaption submits captured glyph frames only and preserves unsupported requests at DPR%i", r => {
    const f = fixture(r), caption = hubShortcutFraction(f.wall, {centerX: 100, centerY: 80, width: 40, height: 40}, 600,
      {counts: f.wall.hubCaptionState!, state: f.wall.hubCaptionState!})!.numerator;
    expect(caption.glyphs).not.toBeNull(); expect(f.receiver.drawHubCaption).toBeTypeOf("function");
    expect(f.receiver.drawHubCaption(caption, r)).toBe(true);
    const drawn = f.events.filter(event => event.kind === "texture"); expect(drawn).toHaveLength(caption.glyphs!.length);
    for (const [index, quad] of caption.glyphs!.entries()) {
      const event = drawn[index]!;
      expect(event.rect).toEqual([quad.x / r, quad.y / r, quad.width / r, quad.height / r]);
      expect(event.texture.source).toBe(f.receiver.textures.nativeJostAtlas.source);
      expect([event.texture.frame.x, event.texture.frame.y, event.texture.frame.width, event.texture.frame.height]).toEqual(quad.frame);
      expect(event.g.kind).toBe("wall");
      expect([...event.g.tint]).toEqual([caption.guiColor.r, caption.guiColor.g, caption.guiColor.b].map(Math.fround));
    }
    f.events.length = 0;
    const unsupported = hubShortcutFraction(f.wall, {centerX: 100, centerY: 80, width: 492 / 11, height: 492 / 11}, 600,
      {counts: f.wall.hubCaptionState!, state: f.wall.hubCaptionState!})!.numerator;
    expect(unsupported.fontSize).toBe(18); expect(unsupported.glyphs).toBeNull();
    expect(f.receiver.drawHubCaption(unsupported, r)).toBe(false); expect(f.events).toHaveLength(0);
    f.receiver.textures.nativeJostAtlas = undefined;
    expect(f.receiver.drawHubCaption(caption, r)).toBe(false); expect(f.events).toHaveLength(0);
  });

  it.each([1, 2])("drawWall applies live physical pop geometry and body→labels→bar at DPR%i", r => {
    const f = fixture(r), {wall, level, receiver, events} = f;
    wall.hubCaptionState = {...wall.hubCaptionState!, counting: true, countingDelta: 1, countingScaleT: .5};
    const rect = {x: 10.25, y: 20.75, width: 40 / r, height: 40 / r};
    receiver.drawWallBody = (g: any, current: any, block: any, popped: Rect, color: any, flipH: any) => events.push({kind: "body", g, current, block, popped, color, flipH});
    receiver.drawHubCaption = f.recordCaption;
    receiver.drawWall(f.graphics("wall"), level, wall, rect, 0xffffff, true);
    const geometry = physical(rect, r), expected = hubShortcutFraction(wall, geometry, 600 * r, {counts: wall.hubCaptionState!, state: wall.hubCaptionState!})!;
    expect(events.map(event => event.kind)).toEqual(["body", "caption", "caption", "fill"]);
    expect(events[0]).toMatchObject({current: level, block: wall, popped: logical(hubShortcutWallGeometry(geometry, .5), r), color: 0xffffff, flipH: true});
    expect(events[1]!.caption).toEqual(expected.numerator); expect(events[2]!.caption).toEqual(expected.denominator);
    expect(events[1]!.resolution).toBe(r);
    expect(events[3]!.rect).toEqual([expected.bar.rect.x / r, expected.bar.rect.y / r, expected.bar.rect.width / r, expected.bar.rect.height / r]);
    expect(events[3]!.g.kind).toBe("wall");
    expect([...events[3]!.g.tint]).toEqual([expected.bar.guiColor.r, expected.bar.guiColor.g, expected.bar.guiColor.b].map(value => Math.fround(value * 2)));
    expect(events[3]!.style).toBe(0xffffff);
    expect(events[0]!.popped.x + events[0]!.popped.width / 2).toBe(rect.x + rect.width / 2);
  });

  it("keeps supported and unsupported exact-size font requests explicit at the wrapper", () => {
    const f = fixture(), {wall, receiver} = f; receiver.drawWallBody = () => {}; receiver.drawHubCaption = f.recordCaption;
    receiver.drawWall(f.graphics("wall"), f.level, wall, {x: 10, y: 20, width: 40, height: 40}, 0xffffff, false);
    const supported = f.events.filter(event => event.kind === "caption");
    expect(supported.map(event => event.caption.fontSize)).toEqual([16, 16]);
    expect(supported.every(event => event.caption.glyphs !== null)).toBe(true);
    f.events.length = 0;
    receiver.drawWall(f.graphics("wall"), f.level, wall, {x: 10, y: 20, width: 492 / 11, height: 492 / 11}, 0xffffff, false);
    const unsupported = f.events.filter(event => event.kind === "caption");
    expect(unsupported.map(event => event.caption.fontSize)).toEqual([18, 18]);
    expect(unsupported.every(event => event.caption.glyphs === null)).toBe(true);
    expect(f.events.at(-1)!.kind).toBe("fill");
  });

  it("continues caption and bar submission after QuickAnim body returns", () => {
    const f = fixture(); f.world.drawStyle = DrawStyle.QuickAnim; f.receiver.drawHubCaption = f.recordCaption;
    f.receiver.drawWall(f.graphics("wall"), f.level, f.wall, {x: 10, y: 20, width: 40, height: 40}, 0xffffff, false);
    expect(f.events.map(event => event.kind)).toEqual(["texture", "caption", "caption", "fill"]);
    expect(f.events[0]!.g.kind).toBe("wall");
  });

  it("real drawLevel applies unclamped source body brightness and restarts wall spans after captions", () => {
    const f = fixture(), {receiver, level, wall, events} = f, view = level.getExitBlock();
    view.color = {h: 0, s: 0, v: 10};
    wall.hubCaptionState = {...wall.hubCaptionState!, unlocking: true, unlockingT: 1.75};
    receiver.drawFloor = () => {}; receiver.drawHubCaption = f.recordCaption;
    receiver.drawWallBody = (g: any, _level: any, block: any) => events.push({kind: "body", block, g});
    const rect = {x: 100, y: 40, width: level.width * 40, height: level.height * 40};
    receiver.drawLevel(f.graphics("scene"), level, view, rect, 0, new Set(), false, rect);
    const index = events.findIndex(event => event.kind === "body" && event.block === wall), body = events[index]!;
    expect(body, "real drawLevel submits the actual shortcut wall body").toBeDefined();
    const base = wallTint(view, 40 / 600), brightness = hubShortcutBodyBrightness(wall.hubCaptionState!);
    expect(brightness).toBe(Math.fround(1.65));
    expect([...body.g.tint].slice(0, 3)).toEqual([...base].slice(0, 3).map(value => Math.fround(value * brightness)));
    expect(Math.max(...body.g.tint.slice(0, 3))).toBeGreaterThan(1);
    const captions = events.slice(index + 1).filter(event => event.kind === "caption"); expect(captions).toHaveLength(2);
    const next = events.slice(index + 1).find(event => event.kind === "body")!; expect(next).toBeDefined();
    expect(next.g.layer).toBeGreaterThan(captions[1]!.g.layer);
    expect([...next.g.tint]).toEqual([...base]);
  });

  it.each([1, 2])("drawFloor expands hard portal body and paused captions from current physical geometry at DPR%i", r => {
    const f = fixture(r), {floor, receiver, events} = f; floor.hard = 2; floor.unlocked = true;
    floor.hubCelebration = {...floor.hubCelebration, celebrationSizeT: .25}; receiver.drawHubCaption = f.recordCaption;
    for (const rect of [{x: 100.3, y: 120.3, width: 30 / r, height: 30 / r}, {x: 150.6, y: 80.4, width: 40 / r, height: 40 / r}]) {
      events.length = 0; receiver.drawFloor(f.graphics("scene"), FloorType.LevelPortal, rect, f.level, floor);
      const expanded = logical(hubPortalCelebrationGeometry(physical(rect, r), .25), r);
      const body = originalDrawRect(expanded, r), inner = originalDrawRect({x: expanded.x + expanded.width * .1,
        y: expanded.y + expanded.height * .1, width: expanded.width * .8, height: expanded.height * .8}, r);
      const expected = hubPausedPortalReference(floor, physical(rect, r), {paused: true, celebrationSizeT: .25})!;
      expect(events.map(event => event.kind)).toEqual(["texture", "texture", "caption", "caption"]);
      expect(events[0]!.rect).toEqual([body.x, body.y, body.width, body.height]);
      expect(events[1]!.rect).toEqual([inner.x, inner.y, inner.width, inner.height]);
      expect(events[2]!.caption).toEqual(expected.shadow); expect(events[3]!.caption).toEqual(expected.foreground);
    }
  });

  it.each([
    {mode: "playing", special: "none", unlocked: true, width: 40},
    {mode: "paused", special: "break", unlocked: true, width: 40},
    {mode: "paused", special: "none", unlocked: false, width: 40},
    {mode: "paused", special: "none", unlocked: true, width: 10},
  ])("drawFloor respects actual paused, break, unlock and strict-size gates %j", config => {
    const f = fixture(); f.receiver.uiState.mode = config.mode; f.receiver.uiState.special.mode = config.special;
    f.floor.unlocked = config.unlocked; f.receiver.drawHubCaption = f.recordCaption;
    f.receiver.drawFloor(f.graphics("scene"), FloorType.LevelPortal, {x: 10, y: 20, width: config.width, height: 40}, f.level, f.floor);
    expect(f.events.filter(event => event.kind === "caption")).toHaveLength(0);
  });

  it("keeps an unlocked hard2 body locked and its marker absent during global unlocking", () => {
    const f = fixture(); f.floor.hard = 2; f.floor.won = false; f.floor.unlocked = true; f.world.hubUnlocking = true;
    f.receiver.drawHubCaption = f.recordCaption; const rect = {x: 10, y: 20, width: 40, height: 40};
    f.receiver.drawFloor(f.graphics("scene"), FloorType.LevelPortal, rect, f.level, f.floor);
    expect(f.events.filter(event => event.kind === "texture").at(-1)!.color).toBe(0x292929);
    expect(f.events.filter(event => event.kind === "caption")).toHaveLength(2);
    f.events.length = 0; f.receiver.drawHubPortalMarker(f.graphics("scene"), f.floor, rect);
    expect(f.events).toHaveLength(0);
    f.world.hubUnlocking = false; f.receiver.drawHubPortalMarker(f.graphics("scene"), f.floor, rect);
    expect(f.events.length).toBeGreaterThan(0);
  });

  it.each([{style: DrawStyle.Normal, flipH: false}, {style: DrawStyle.QuickAnim, flipH: true}])(
    "drawLevel submits actual celebration particles once in the late clipped pass %j", ({style, flipH}) => {
      const f = fixture(), {receiver, level, events} = f; f.world.drawStyle = style;
      level.getExitBlock().locked = true; // Identify the actual parent border's red strips.
      receiver.uiState.preferences.disableParticles = false;
      spawnHubCelebrationEdgeParticles(level, () => .5); expect(level.particles).toHaveLength(16);
      receiver.drawFloor = () => {}; receiver.drawHubCaption = f.recordCaption;
      receiver.drawWallBody = (_g: any, _level: any, block: any) => events.push({kind: "body", block});
      const parentContainer = receiver.activeSceneContainer, rect = {x: 100, y: 40, width: level.width * 40, height: level.height * 40};
      receiver.drawLevel(f.graphics("scene"), level, level.getExitBlock(), rect, 0, new Set(), flipH, rect);
      const particles = events.filter(event => event.kind === "fill" && event.style?.alpha === Math.fround(.4));
      expect(particles).toHaveLength(16);
      const lastBody = Math.max(...events.flatMap((event, index) => event.kind === "body" ? [index] : []));
      for (const [index, event] of particles.entries()) {
        const particle = level.particles[index]!, width = rect.width * particle.size, height = rect.height * particle.size;
        const expected = originalDrawRect({x: rect.x + rect.width / 2 + rect.width * particle.x * (flipH ? -1 : 1) - width / 2,
          y: rect.y + rect.height / 2 + rect.height * particle.y - height / 2, width, height}, 1);
        expect(event.rect).toEqual([expected.x, expected.y, expected.width, expected.height]);
        expect(event.g.clip).toEqual(rect); expect(events.indexOf(event)).toBeGreaterThan(lastBody);
      }
      if (style === DrawStyle.Normal) {
        const borders = events.filter(event => event.kind === "fill" && event.style === 0xff0000);
        expect(borders.length).toBeGreaterThan(0);
        for (const border of borders) {
          expect(events.indexOf(border)).toBeGreaterThan(events.indexOf(particles.at(-1)!));
          expect(border.g.layer).toBeGreaterThan(particles.at(-1)!.g.layer);
        }
      }
      expect(receiver.activeSceneContainer).toBe(parentContainer);
    });

  it("honors DisableParticles for the actual late celebration pass", () => {
    const f = fixture(); spawnHubCelebrationEdgeParticles(f.level, () => .5);
    f.receiver.drawFloor = () => {}; f.receiver.drawWallBody = () => {}; f.receiver.drawHubCaption = f.recordCaption;
    const rect = {x: 100, y: 40, width: f.level.width * 40, height: f.level.height * 40};
    f.receiver.drawLevel(f.graphics("scene"), f.level, f.level.getExitBlock(), rect, 0, new Set(), false, rect);
    expect(f.events.filter(event => event.kind === "fill" && event.style?.alpha === Math.fround(.4))).toHaveLength(0);
  });
});
