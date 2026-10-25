import {describe, expect, it} from 'vitest';
import source from '../src/assets/levels/first_puzzle.txt?raw';
import {parseLevel} from '../src/core/levelParser';
import {updateWorldAnimations} from '../src/core/animation';
import {createHubCaptionWallState} from '../src/core/hubCaptionState';
import {updateHubCaptionBlock} from '../src/core/hubCaptionLifecycle';

const state = () => createHubCaptionWallState({numRequired: 3, numSolved: 2, numSolvedUncapped: 2});
const context = {deltaTime: .001, nonMovementDeltaTime: .1, quickAnim: false, handleActionFloor: () => false, random: () => .5};

describe('native Hub lifecycle scheduling source contracts', () => {
  it('uses full nonmovement delta and keeps movement delta independent', () => {
    const world = parseLevel(source, 'first_puzzle'), wall = world.blocks.find(b => !b.subLevel && !b.isPlayer)!;
    wall.hubCaptionState = {...state(), unlocking: true}; world.hubUnlocking = true;
    updateWorldAnimations(world, context);
    expect(wall.hubCaptionState.unlockingT).toBe(Math.fround(.1));
  });
  it('preserves the native forward removal skip and direct global unlocking assignment', () => {
    const world = parseLevel(source, 'first_puzzle'), walls = world.blocks.filter(b => !b.subLevel && !b.isPlayer).slice(0, 2);
    expect(walls).toHaveLength(2);
    // Isolate the same real block references in the World.blocks scheduling list.
    world.blocks.splice(0, world.blocks.length, ...walls); world.hubUnlocking = true;
    walls[0]!.hubCaptionState = {...state(), unlocking: true, unlockingT: 1.7};
    walls[1]!.hubCaptionState = {...state(), unlocking: true};
    updateWorldAnimations(world, context);
    expect(world.blocks).toEqual([walls[1]]);
    expect(walls[0]!.outerLevel!.getBlock(walls[0]!.x, walls[0]!.y)).toBeNull();
    expect(walls[1]!.hubCaptionState!.unlockingT).toBe(0);
    expect(world.hubUnlocking).toBe(false);
    expect(walls[0]!.outerLevel!.particles).toHaveLength(12);
    updateWorldAnimations(world, context);
    expect(walls[1]!.hubCaptionState!.unlockingT).toBe(Math.fround(.1));
  });
  it('does not advance unlocking until the update after this wall clears counting', () => {
    const world = parseLevel(source, 'first_puzzle'), wall = world.blocks.find(b => !b.subLevel && !b.isPlayer)!;
    wall.hubCaptionState = {...state(), unlocking: true, counting: true, countingT: .99, countingTotalDelta: 1, countingDelta: 1};
    world.hubCounting = true; world.hubUnlocking = true;
    updateHubCaptionBlock(world, wall, .01, () => .5);
    expect(world.hubCounting).toBe(false); expect(wall.hubCaptionState.unlockingT).toBe(0);
    expect(wall.outerLevel!.particles).toHaveLength(3);
    updateHubCaptionBlock(world, wall, .01, () => .5);
    expect(wall.hubCaptionState.unlockingT).toBe(Math.fround(.01));
  });
  it('assigns counting false directly even while a following wall is still counting', () => {
    const world = parseLevel(source, 'first_puzzle'), walls = world.blocks.filter(b => !b.subLevel && !b.isPlayer).slice(0, 2);
    world.blocks.splice(0, world.blocks.length, ...walls); world.hubCounting = true;
    walls[0]!.hubCaptionState = {...state(), counting: true, countingT: 1, countingTotalDelta: 1};
    walls[1]!.hubCaptionState = {...state(), counting: true, countingT: -2.5, countingTotalDelta: 2};
    updateWorldAnimations(world, context);
    expect(world.hubCounting).toBe(false); expect(walls[1]!.hubCaptionState!.counting).toBe(true);
  });
});
