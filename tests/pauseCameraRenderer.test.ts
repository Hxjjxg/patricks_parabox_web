import {describe, expect, it} from 'vitest';
import {parseLevel} from '../src/core/levelParser';
import {getLevelSource} from '../src/core/levelRepository';
import {GameRenderer} from '../src/render/GameRenderer';
import {PauseCamera} from '../src/core/pauseCamera';

describe('native pause camera render branch', () => {
  it.each([1, 2])('uses physical paused focus instead of gameplay offsets atDPR%i', resolution => {
    const world = parseLevel(getLevelSource('first_puzzle'), 'first_puzzle');
    const pause = new PauseCamera(); pause.enterPause(1);
    Object.assign(world, {pauseCamera: pause, newX: .4, newY: -.3, newXS: .2, newYS: .3, newCamT: .4});
    Object.assign(world, {usedX: .6, usedY: -.8, usedXS: .25, usedYS: .75});
    const tickets: object[] = [], g: any = new Proxy({}, {get: () => () => g});
    const r = Object.assign(Object.create(GameRenderer.prototype), {
      world, app: {screen: {width: 801, height: 601}, renderer: {resolution}},
      scene: {}, maskPasses: [], sceneLayers: [], uiState: {mode: 'paused'}, elapsed: 0,
      inspectionBlock: null, inspectionFlipH: false, nextSceneLayer: () => g, drawVoid() {},
      drawControls() {}, drawModeOverlay() {}, winText: {position: {set() {}}},
      drawScenePass(_b: unknown, rect: object) {tickets.push(rect);},
    });
    r.draw();
    expect([world.usedX, world.usedY, world.usedXS, world.usedYS]).toEqual([.6, -.8, .25, .75]);
    const sample = pause.sample({width: 801 * resolution, height: 601 * resolution, paused: true})!;
    expect(tickets).toEqual([{x: (sample.centerX - sample.size / 2) / resolution,
      y: (sample.centerY - sample.size / 2) / resolution, width: sample.size / resolution, height: sample.size / resolution}]);
  });
});
