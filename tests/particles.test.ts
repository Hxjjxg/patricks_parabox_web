import { describe, expect, it } from "vitest";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import {
  moveParticles,
  preWarmParticles,
  spawnParticleBlock,
  spawnParticleLevel,
  updateParticles,
} from "../src/core/particles";

function seededRandom(seed = 7): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function loadFirstPuzzle() {
  return parseLevel(getLevelSource("first_puzzle"), "first_puzzle");
}

describe("block particles (Particle.SpawnParticleBlock)", () => {
  it("spawns a tinted mote on a random side of a box", () => {
    const world = loadFirstPuzzle();
    const random = seededRandom();
    const player = world.findPlayerBlock();
    const level = player.outerLevel!;
    const particle = spawnParticleBlock(level, player, random);
    expect(particle).not.toBeNull();
    expect(level.particles).toContain(particle);
    expect(particle!.size).toBeCloseTo(0.5 / Math.max(level.width, level.height));
    expect(particle!.alpha).toBeCloseTo(0.25);
    expect(particle!.hue).toBeCloseTo(player.color.h);
    expect(particle!.sat).toBeCloseTo(player.color.s);
    expect(particle!.val).toBeCloseTo(player.color.v);
    expect(particle!.deltaSize).toBeLessThan(0);
    expect(player.lastPartSpawnSide).toBeGreaterThanOrEqual(0);
    expect(player.lastPartSpawnSide).toBeLessThan(4);
    // Cell centre for a 7x7 level at (2, 2).
    expect(particle!.y).toBeCloseTo(-(2 - 3) / 7, 1);
  });

  it("skips enter/exit-scaled boxes and 1x1 levels", () => {
    const world = loadFirstPuzzle();
    const random = seededRandom();
    const player = world.findPlayerBlock();
    player.anim = "enterExit";
    player.drawXScale = 2;
    expect(spawnParticleBlock(player.outerLevel!, player, random)).toBeNull();
    player.drawXScale = 1;
    player.anim = "normal";
    const tiny = player.subLevel!;
    expect(tiny.width).toBe(1);
    expect(tiny.height).toBe(1);
    expect(spawnParticleBlock(tiny, player, random)).toBeNull();
  });
});

describe("particle clock (Particle.Update)", () => {
  it("emits block motes every 0.6s for every box", () => {
    const world = loadFirstPuzzle();
    const boxes = world.blocks.filter(
      (block) =>
        block.subLevel &&
        block.outerLevel !== null &&
        !(
          block.outerLevel.width === 1 &&
          block.outerLevel.height === 1
        ),
    );
    const random = seededRandom();
    updateParticles(world, 0.3, { inHub: false, random });
    expect(world.levels.every((level) => level.particles.length === 0)).toBe(
      true,
    );
    updateParticles(world, 0.31, { inHub: false, random });
    const spawned = world.levels.reduce(
      (total, level) => total + level.particles.length,
      0,
    );
    expect(spawned).toBe(boxes.length);
  });

  it("retires motes that shrink away or leave the level", () => {
    const world = loadFirstPuzzle();
    const level = world.findPlayerBlock().outerLevel!;
    level.particles.push({
      x: 0,
      y: 0,
      size: 0.1,
      deltaX: 0,
      deltaY: 0,
      deltaSize: -10,
      slowDown: 1,
      hue: 0,
      sat: 0,
      val: 1,
      alpha: 0.25,
      celebration: false,
    });
    moveParticles(level, 0.05);
    expect(level.particles).toHaveLength(0);

    level.particles.push({
      x: 2,
      y: 0,
      size: 0.1,
      deltaX: 0,
      deltaY: 0,
      deltaSize: 0,
      slowDown: 1,
      hue: 0,
      sat: 0,
      val: 1,
      alpha: 0.25,
      celebration: false,
    });
    moveParticles(level, 0.05);
    expect(level.particles).toHaveLength(0);
  });

  it("only spawns faint level motes in the hub", () => {
    const world = loadFirstPuzzle();
    const random = seededRandom();
    updateParticles(world, 5.2, { inHub: false, random });
    expect(
      world.levels.every((level) =>
        level.particles.every((particle) => particle.alpha !== 0.035),
      ),
    ).toBe(true);

    const hubWorld = loadFirstPuzzle();
    updateParticles(hubWorld, 5.2, {
      inHub: true,
      random: seededRandom(),
      playerParticlesEnabled: false,
    });
    const faint = hubWorld.levels.flatMap((level) =>
      level.particles.filter((particle) => particle.alpha === 0.035),
    );
    expect(faint).toHaveLength(hubWorld.levels.length);
    expect(faint[0]!.size).toBeGreaterThanOrEqual(0.3);
    expect(faint[0]!.size).toBeLessThanOrEqual(0.5);
  });
});

describe("prewarm", () => {
  it("starts levels with settled motes around boxes", () => {
    const world = loadFirstPuzzle();
    const random = seededRandom();
    preWarmParticles(world, false, random);
    const level = world.findPlayerBlock().outerLevel!;
    const boxes = level.blockList.filter((block) => block.subLevel);
    expect(level.particles.length).toBe(boxes.length * 7);
  });

  it("spawns a level mote directly", () => {
    const world = loadFirstPuzzle();
    const level = world.findPlayerBlock().outerLevel!;
    const particle = spawnParticleLevel(level, seededRandom());
    expect(particle.alpha).toBeCloseTo(0.035);
    expect(Math.abs(particle.x)).toBeGreaterThanOrEqual(0.5 - 0.6);
    expect(level.particles).toContain(particle);
  });
});
