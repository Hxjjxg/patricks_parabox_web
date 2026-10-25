import {expect, it} from 'vitest';
import {DrawStyle, FloorType, WorldModel} from '../src/core/model';
import {GameRenderer} from '../src/render/GameRenderer';
import {guiHsvColor} from '../src/render/borderRendering';

function drawBorder(levelName: string, drawStyle: DrawStyle, depth: number, buttonsSatisfied = false) {
  const world = new WorldModel(levelName), outer = world.createLevel(3, 3), sub = world.createLevel(1, 1);
  const block = world.createBlock(1, 1, outer, sub);
  block.isPlayer = true; block.color = {h: .9, s: 1, v: .7};
  world.createFloor(1, 1, outer, FloorType.PlayerButton);
  world.createBlock(0, 0, sub, null);
  world.computeBlockLists(); sub.blockList.length = 0;
  world.drawStyle = drawStyle; world.buttonsSatisfied = buttonsSatisfied;
  const fills: Array<{rect: number[]; color: unknown}> = [];
  let rect: number[] = [];
  const graphics: any = {
    rect(...values: number[]) {rect = values; return this;},
    fill(color: unknown) {fills.push({rect, color}); return this;},
  };
  const renderer = Object.assign(Object.create(GameRenderer.prototype), {
    app: {screen: {width: 800, height: 600}, renderer: {resolution: 1}},
    world, textures: {centerGradient: {}}, elapsed: 0,
    onScreen: () => true, nextWallLayer: () => graphics, nextSceneLayer: () => graphics,
    drawHubConnections: () => {},
  });
  renderer.drawLevel(graphics, sub, block, {x: 20, y: 30, width: 60, height: 60}, depth, new Set(), false);
  const strips = fills.filter(call => call.rect[2] === 2 || call.rect[3] === 2);
  expect(strips).toHaveLength(4);
  return {colors: strips.map(call => call.color), base: guiHsvColor({h: .9, s: 1.2, v: .7 * .18})};
}

it('forwards actual native GRID ticket depth to the border draw', () => {
  const root = drawBorder('grid_clone', DrawStyle.Grid, 0);
  expect(root.colors).toEqual(Array(4).fill(root.base));
  expect(drawBorder('grid_clone', DrawStyle.Grid, 1).colors).toEqual(Array(4).fill(0xffffff));
});

it('forwards actual Hub ButtonsSatisfied instead of treating every covered goal as white', () => {
  const hub = drawBorder('hub', DrawStyle.Normal, 0);
  expect(hub.colors).toEqual(Array(4).fill(hub.base));
  expect(drawBorder('hub', DrawStyle.Normal, 0, true).colors).toEqual(Array(4).fill(0xffffff));
});
