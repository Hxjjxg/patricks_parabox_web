import {FloorType, type Block, type WorldModel} from "./model";
import {advanceHubCaptionWall, advanceHubPortalCelebration, advanceHubCelebrationClock} from "./hubCaptionState";
import {spawnParticleBlock, spawnParticlePortal} from "./particles";
import {spawnHubCelebrationEdgeParticles} from "./hubCelebrationParticles";

/** Called on the same local block before movement animation, including removal. */
export function updateHubCaptionBlock(world: WorldModel, block: Block, deltaTime: number, random = Math.random): void {
  if (!block.hubCaptionState) return;
  const result = advanceHubCaptionWall(block.hubCaptionState, deltaTime, world.hubCounting);
  block.hubCaptionState = result.state;
  world.hubCounting = result.worldCounting;
  if (result.removed) {
    world.removeBlock(block);
    world.hubUnlocking = false;
    for (let index = 0; index < result.unlockPop!.particles; index++) {
      spawnParticleBlock(block.outerLevel!, block, random);
    }
  }
  if (result.countPop) {
    for (let index = 0; index < result.countPop.particles; index++) {
      spawnParticleBlock(block.outerLevel!, block, random);
    }
  }
}

/** Native floor stage runs while paused too, before the global clock. */
export function updateHubPortalCelebrations(world: WorldModel, deltaTime: number, random = Math.random): void {
  for (const floor of world.floors) {
    if (floor.type !== FloorType.LevelPortal) continue;
    const result = advanceHubPortalCelebration(floor.hubCelebration, deltaTime, {
      levelMatches: floor.outerLevel === world.hubCelebrationLevel,
      celebrationT: world.hubCelebration.t, celebrationNumLevels: world.hubCelebrationNumLevels,
    });
    floor.hubCelebration = result.state;
    if (result.pop) for (let index = 0; index < result.pop.particles; index++) {
      spawnParticlePortal(floor.outerLevel, floor, true, random);
    }
  }
}

/** Native later World stage follows Particle.Update; new edge particles stay unmoved. */
export function updateHubCelebrationClock(world: WorldModel, deltaTime: number, playing: boolean, random = Math.random): void {
  const level = world.hubCelebrationLevel;
  const result = advanceHubCelebrationClock({...world.hubCelebration, levelAttached: level !== null}, deltaTime,
    {playing, unlocking: world.hubUnlocking, counting: world.hubCounting});
  world.hubCelebration = result.state;
  if (result.edgeParticleBurst && level) spawnHubCelebrationEdgeParticles(level, random);
  if (!result.state.levelAttached) world.hubCelebrationLevel = null;
}
