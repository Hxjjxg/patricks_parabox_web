import type { Block, Floor, Level, Particle, WorldModel } from "./model";
import { lerp } from "./animation";

/**
 * Port of the original `Particle` class.
 *
 * Every box leaks small square motes from one random side, and the hub also
 * gets huge, very faint squares that drift inward from just outside each
 * level. Coordinates are level-relative: (0, 0) is the level centre and the
 * level spans -0.5..0.5, matching `Draw.ProcessTicket`'s particle pass.
 */

const BLOCK_PERIOD = 0.6;
const LEVEL_PERIOD = 5.1;
const BLOCK_ALPHA = 0.25;
const LEVEL_ALPHA = 0.035;
const CELEBRATION_ALPHA = 0.4;

export interface ParticleOptions {
  readonly inHub: boolean;
  /** False while FastTravel/Break hide the player, matching the original. */
  readonly playerParticlesEnabled?: boolean;
  readonly random?: () => number;
}

function randomRange(random: () => number, min: number, max: number): number {
  return min + random() * (max - min);
}

function randomInt(
  random: () => number,
  min: number,
  maxExclusive: number,
): number {
  return min + Math.floor(random() * (maxExclusive - min));
}

function createParticle(): Particle {
  return {
    x: 0,
    y: 0,
    size: 0,
    deltaX: 0,
    deltaY: 0,
    deltaSize: 0,
    slowDown: 1,
    hue: 0,
    sat: 0,
    val: 1,
    alpha: BLOCK_ALPHA,
    celebration: false,
  };
}

function pickSpawnSide(
  random: () => number,
  previous: number,
): number {
  let side = randomInt(random, 0, 4);
  for (let attempt = 0; attempt < 7 && side === previous; attempt++) {
    side = randomInt(random, 0, 4);
  }
  return side;
}

function launchFromSide(
  particle: Particle,
  side: number,
  horizontalMargin: number,
  verticalMargin: number,
  speed: number,
  random: () => number,
): void {
  const a = lerp(-horizontalMargin, horizontalMargin, smoothStep01(random()));
  const b = lerp(-horizontalMargin, horizontalMargin, random());
  const c = lerp(-verticalMargin, verticalMargin, smoothStep01(random()));
  const d = lerp(-verticalMargin, verticalMargin, random());
  if (side === 0) {
    particle.x += a;
    particle.y += verticalMargin;
    particle.deltaX += b * speed;
    particle.deltaY += verticalMargin * speed;
  } else if (side === 1) {
    particle.x += a;
    particle.y -= verticalMargin;
    particle.deltaX += b * speed;
    particle.deltaY -= verticalMargin * speed;
  } else if (side === 2) {
    particle.x += horizontalMargin;
    particle.y += c;
    particle.deltaX += horizontalMargin * speed;
    particle.deltaY += d * speed;
  } else {
    particle.x -= horizontalMargin;
    particle.y += c;
    particle.deltaX -= horizontalMargin * speed;
    particle.deltaY += d * speed;
  }
}

/** Unity's `Mathf.SmoothStep(0, 1, t)`. */
function smoothStep01(t: number): number {
  const k = t < 0 ? 0 : t > 1 ? 1 : t;
  return k * k * (3 - 2 * k);
}

/** `Particle.SpawnParticleBlock`. */
export function spawnParticleBlock(
  level: Level,
  block: Block,
  random: () => number = Math.random,
): Particle | null {
  if (
    block.anim === "enterExit" &&
    (block.drawXScale !== 1 || block.drawYScale !== 1)
  ) {
    return null;
  }
  if (level.width === 1 && level.height === 1) return null;

  const particle = createParticle();
  const isWall = block.subLevel === null;
  const speed = isWall ? randomRange(random, 2, 6) : 0.75;
  const shrink = isWall ? randomRange(random, 2, 3) : 1;

  particle.x = (block.x - (level.width - 1) / 2) / level.width;
  particle.y = -(block.y - (level.height - 1) / 2) / level.height;
  particle.size = (1 / Math.max(level.width, level.height)) * 0.5;
  particle.x += block.drawXOffset / level.width;
  particle.y += block.drawYOffset / level.height;
  if (block.drawXScale < 1) particle.size *= block.drawXScale;

  // Walls take the colour of the box that contains their level.
  const colorSource =
    isWall ? (level.blocksWithThisAsTheirSubLevel[0] ?? block) : block;
  particle.hue = colorSource.color.h;
  particle.sat = colorSource.color.s;
  particle.val = colorSource.color.v;

  let horizontal = particle.size / 2;
  let vertical = particle.size / 2;
  if (level.width > level.height) {
    vertical *= level.width / level.height;
  } else if (level.width < level.height) {
    horizontal *= level.height / level.width;
  }
  const marginX =
    (1 / level.width / 2) * block.drawXScale - horizontal;
  const marginY =
    (1 / level.height / 2) * block.drawYScale - vertical;

  particle.deltaSize = (-particle.size / 2.5) * shrink;
  const side = pickSpawnSide(random, block.lastPartSpawnSide);
  block.lastPartSpawnSide = side;
  launchFromSide(particle, side, marginX, marginY, speed, random);

  particle.alpha = BLOCK_ALPHA;
  level.particles.push(particle);
  return particle;
}

/** `Particle.SpawnParticleLevel`. */
export function spawnParticleLevel(
  level: Level,
  random: () => number = Math.random,
): Particle {
  const particle = createParticle();
  level.particles.push(particle);
  particle.size = randomRange(random, 0.3, 0.5);
  const colorSource =
    level.blocksWithThisAsTheirSubLevel[0] ?? null;
  if (colorSource) {
    particle.hue = colorSource.color.h;
    particle.sat = colorSource.color.s;
    particle.val = colorSource.color.v;
  }
  particle.alpha = LEVEL_ALPHA;

  const side = pickSpawnSide(random, level.lastPartSpawnSide);
  level.lastPartSpawnSide = side;
  const along = lerp(
    -0.5,
    0.5,
    smoothStep01(random()),
  );
  const drift = randomRange(random, -0.05, 0.05);
  const inward = 0.05;
  if (side === 0) {
    particle.x = along;
    particle.y = -0.5 - particle.size / 2;
    particle.deltaX = drift;
    particle.deltaY = inward;
  } else if (side === 1) {
    particle.x = along;
    particle.y = 0.5 + particle.size / 2;
    particle.deltaX = drift;
    particle.deltaY = -inward;
  } else if (side === 2) {
    particle.x = -0.5 - particle.size / 2;
    particle.y = along;
    particle.deltaX = inward;
    particle.deltaY = drift;
  } else {
    particle.x = 0.5 + particle.size / 2;
    particle.y = along;
    particle.deltaX = -inward;
    particle.deltaY = drift;
  }
  return particle;
}

/** `Particle.SpawnParticlePortal` (hard / visual hub portals). */
export function spawnParticlePortal(
  level: Level,
  floor: Floor,
  celebration = false,
  random: () => number = Math.random,
): Particle | null {
  if (floor.hard !== 1 && floor.hard !== 2 && !celebration) return null;
  const particle = createParticle();
  let speed = 2.6;
  let shrink = 0.68;
  if (celebration) {
    speed = 6;
    shrink = 10;
  }
  particle.x = (floor.x - (level.width - 1) / 2) / level.width;
  particle.y = -(floor.y - (level.height - 1) / 2) / level.height;
  particle.size = (1 / Math.max(level.width, level.height)) * 0.65;
  if (celebration) {
    particle.alpha = CELEBRATION_ALPHA;
    particle.celebration = true;
  } else if (floor.hard === 1) {
    particle.hue = 0;
    particle.sat = 0.9;
    particle.val = 0.8;
    particle.alpha = 1;
  } else {
    particle.hue = 0.53;
    particle.sat = 1;
    particle.val = 1;
    particle.alpha = 1;
  }
  let marginX = (1 / level.width) * 0.75 / 2 - particle.size / 2;
  let marginY = (1 / level.height) * 0.75 / 2 - particle.size / 2;
  if (marginX < 0) marginX = 0;
  if (marginY < 0) marginY = 0;
  if (celebration) {
    marginX *= 9;
    marginY *= 9;
  }
  particle.deltaSize = (-particle.size / 4) * shrink;
  const side = pickSpawnSide(random, floor.lastPartSpawnSide);
  floor.lastPartSpawnSide = side;
  launchFromSide(particle, side, marginX, marginY, speed, random);
  level.particles.push(particle);
  if (celebration) particle.size *= 0.8;
  return particle;
}

/** `Particle.MoveParticle`. */
export function moveParticle(particle: Particle, deltaTime: number): void {
  const damping = lerp(1, particle.slowDown, deltaTime * 60);
  particle.deltaX *= damping;
  particle.deltaY *= damping;
  particle.x += particle.deltaX * deltaTime;
  particle.y += particle.deltaY * deltaTime;
  particle.size += particle.deltaSize * deltaTime;
}

/** `Particle.MoveParticles`: advance and retire motes that left the level. */
export function moveParticles(level: Level, deltaTime: number): void {
  for (let index = level.particles.length - 1; index >= 0; index--) {
    const particle = level.particles[index]!;
    moveParticle(particle, deltaTime);
    if (
      particle.size < 0 ||
      particle.x - particle.size > 0.5 ||
      particle.x + particle.size < -0.5 ||
      particle.y - particle.size > 0.5 ||
      particle.y + particle.size < -0.5
    ) {
      level.particles.splice(index, 1);
    }
  }
}

/** `Particle.Update`. */
export function updateParticles(
  world: WorldModel,
  deltaTime: number,
  options: ParticleOptions,
): void {
  if (deltaTime <= 0) return;
  const random = options.random ?? Math.random;
  const playerParticlesEnabled = options.playerParticlesEnabled ?? true;
  const previous = world.particleT;
  world.particleT += deltaTime;
  const spawnBlocks =
    Math.floor(world.particleT / BLOCK_PERIOD) !==
    Math.floor(previous / BLOCK_PERIOD);
  const spawnLevels =
    Math.floor(world.particleT / LEVEL_PERIOD) !==
    Math.floor(previous / LEVEL_PERIOD) &&
    options.inHub;

  for (const level of world.levels) {
    if (spawnBlocks) {
      for (const block of level.blockList) {
        if (!block.subLevel) continue;
        if (block.isPlayer && !playerParticlesEnabled) continue;
        spawnParticleBlock(level, block, random);
      }
    }
    if (spawnLevels) {
      spawnParticleLevel(level, random);
    }
    moveParticles(level, deltaTime);
  }
}

/** `Particle.PreWarm`: fill a freshly loaded world with settled motes. */
export function preWarmParticles(
  world: WorldModel,
  inHub: boolean,
  random: () => number = Math.random,
): void {
  for (const level of world.levels) {
    for (let step = 0; step < 7; step++) {
      for (const block of level.blockList) {
        if (!block.subLevel) continue;
        const particle = spawnParticleBlock(level, block, random);
        if (particle) moveParticle(particle, step * BLOCK_PERIOD);
      }
    }
    if (inHub) {
      for (let step = 0; step < 10; step++) {
        moveParticle(spawnParticleLevel(level, random), step * LEVEL_PERIOD);
      }
    }
  }
}
