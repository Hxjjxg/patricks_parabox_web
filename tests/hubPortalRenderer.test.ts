import { describe, expect, it } from 'vitest';
import hubSource from '../src/assets/levels/hub.txt?raw';
import { parseLevel } from '../src/core/levelParser';
import { ProgressionModel } from '../src/core/progression';
import { GameRenderer } from '../src/render/GameRenderer';
import { Container } from 'pixi.js';
import { Block, DrawStyle, Floor, FloorType, Level } from '../src/core/model';

function drawIntro(resolution = 1) {
  const world = parseLevel(hubSource, 'hub');
  new ProgressionModel({wonLevels: ['third_puzzle']}).applyToHub(world);
  const level = world.levels.find(level => level.hubAreaName === 'Area_Intro')!;
  const calls: Array<{rect: number[]; color: number; alpha: number}> = [];
  let rect: number[] = [];
  const g = {rect: (...value: number[]) => {rect = value; return g;},
    fill: (style: {color: number; alpha: number}) => {calls.push({rect, ...style}); return g;}};
  const receiver = Object.assign(Object.create(GameRenderer.prototype), {
    app: {screen: {width: 800, height: 600}, renderer: {resolution}}, draw: () => {},
  });
  receiver.setWorld(world);
  receiver.drawHubConnections(g, level, level.getExitBlock(), {x: 154, y: 54, width: 492, height: 492}, false);
  return {world, level, calls};
}

describe('native Hub renderer connection integration', () => {
  it('submits both complete opaque passes before portal bodies with native colors and bounds', () => {
    const {calls} = drawIntro();
    expect(calls).toHaveLength(10);
    expect(calls.slice(0, 5)).toEqual(calls.slice(5));
    expect(calls[0]).toEqual({rect: [258, 248, 104, 14], color: 0x3c70be, alpha: 1});
    expect(calls.slice(0, 5).map(call => call.color)).toEqual([0x3c70be, 0x3c70be, 0x0a1c34, 0x0a1c34, 0x0a1c34]);
  });
  it.each([1, 2])('snaps native line endpoints and thickness in physical pixels atDPR%i', resolution => {
    const {calls} = drawIntro(resolution);
    expect(calls).toHaveLength(10);
    expect(calls.every(call => call.rect.every(value => Number.isInteger(value * resolution)))).toBe(true);
  });
  it('retains original shortcut coordinates even after progression removes blocking tiles', () => {
    const {world, level} = drawIntro();
    const original = [...world.hubUnlockWalls];
    expect(original).toHaveLength(27);
    const wonLevels = level.floorList.filter(floor => floor.sceneName).map(floor => floor.sceneName);
    const progress = new ProgressionModel({wonLevels});
    progress.applyToHub(world);
    expect(level.getBlock(5, 2)).toBeNull();
    expect(world.hubUnlockWalls).toEqual(original);
    expect(original.find(block => block.outerLevel === level && block.unlockerScene === 'lock_door')).toMatchObject({x: 5, y: 2});
  });
  it('queues portal bodies after shadows and before all corner markers and player faces', () => {
    const level = new Level(1, 3, 3), root = new Block(1), player = new Block(2);
    root.init(0, 0, null, level);
    player.init(1, 1, level, new Level(2, 1, 1)); player.isPlayer = player.drawIsPlayer = true;
    level.blockList.push(player);
    const floors = [new Floor(10, 0, 0, level, FloorType.LevelPortal), new Floor(11, 2, 0, level, FloorType.LevelPortal)];
    floors[0]!.unlocked = true; floors[1]!.won = true;
    level.floorList.push(...floors);
    const events: string[] = [], g: object = new Proxy({}, {get: () => () => g});
    const receiver = Object.assign(Object.create(GameRenderer.prototype), {
      app: {screen: {width: 800, height: 600}, renderer: {resolution: 1}},
      world: {levelName: 'hub', drawStyle: DrawStyle.Normal}, scene: new Container(),
      maskPasses: [], maskPassCount: 0, textures: {centerGradient: {}}, onScreen: () => true,
      nextSceneLayer: () => g, nextWallLayer: () => g, drawInfEffect: () => {},
      drawHubConnections: (_g: unknown, current: Level) => { if (current === level) events.push('links'); },
      drawHubPortalShadow: (_g: unknown, floor: Floor) => events.push('shadow' + floor.x),
      drawFloor: (_g: unknown, _t: unknown, _r: unknown, _l: unknown, floor: Floor) => events.push('body' + floor.x),
      drawHubPortalMarker: (_g: unknown, floor: Floor) => events.push('marker' + floor.x),
      drawFace: () => events.push('face'),
    });
    receiver.drawScenePass(root, {x: 100, y: 100, width: 300, height: 300}, 0, false, null);
    expect(events).toEqual(['links', 'shadow2', 'shadow0', 'body2', 'body0', 'marker2', 'marker0', 'face']);
  });
});
