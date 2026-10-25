import {describe, expect, it, vi} from "vitest";
import {Level, type Particle} from "../src/core/model";
import {spawnHubCelebrationEdgeParticles} from "../src/core/hubCelebrationParticles";

const distance = 0.5149999856948853;
const inwardYMin = 0.07000000029802322;
const inwardXMin = 0.10500000417232513;
const f = Math.fround;

function repeating(values: readonly number[]): () => number {
  let index = 0;
  return () => values[index++ % values.length]!;
}

describe("source-only Particle.SpawnCelebrationEdgeParticles", () => {
  it("appends exactly sixteen distinct objects without changing existing particles", () => {
    const level = new Level(1, 3, 5);
    spawnHubCelebrationEdgeParticles(level, () => .5);
    const retained = [...level.particles];
    const before = JSON.stringify(retained);
    let calls = 0;
    expect(spawnHubCelebrationEdgeParticles(level, () => {calls++; return .5;})).toBeUndefined();
    expect(calls).toBe(64);
    expect(level.particles).toHaveLength(32);
    expect(level.particles.slice(0, 16)).toEqual(retained);
    expect(JSON.stringify(retained)).toBe(before);
    expect(new Set(level.particles).size).toBe(32);
  });

  it("interleaves +Y,-Y,+X,-X at each of four ordered stations", () => {
    const level = new Level(1);
    spawnHubCelebrationEdgeParticles(level, () => .5);
    const expected: Array<[number, number]> = [];
    for (const station of [-.375, -.125, .125, .375]) {
      expected.push([station, distance], [station, -distance],
        [distance, station], [-distance, station]);
    }
    expect(level.particles.map(p => [p.x, p.y])).toEqual(expected);
  });

  it("sets white celebration state and source size, opacity and damping on every edge", () => {
    const level = new Level(1);
    spawnHubCelebrationEdgeParticles(level, () => .5);
    for (const particle of level.particles) {
      expect(particle).toMatchObject({hue: 0, sat: 0, val: 1, celebration: true,
        alpha: 0.4000000059604645, size: 0.05000000074505806,
        slowDown: 0.9850000143051147, deltaSize: -0.06750000268220901});
      for (const value of Object.values(particle)) {
        if (typeof value === "number") expect(f(value)).toBe(value);
      }
    }
  });

  it("uses jitter, shrink,deltaX,deltaY unit samples in that order for every particle", () => {
    const level = new Level(1);
    spawnHubCelebrationEdgeParticles(level, repeating([0, .25, .5, .75]));
    expect(level.particles.slice(0, 4)).toEqual([
      {x: -.42500001192092896, y: distance, size: f(.05),
        deltaX: 0, deltaY: -.2800000011920929, deltaSize: -.07874999940395355,
        slowDown: f(.985), hue: 0, sat: 0, val: 1, alpha: f(.4), celebration: true},
      {x: -.42500001192092896, y: -distance, size: f(.05),
        deltaX: 0, deltaY: .2800000011920929, deltaSize: -.07874999940395355,
        slowDown: f(.985), hue: 0, sat: 0, val: 1, alpha: f(.4), celebration: true},
      {x: distance, y: -.42500001192092896, size: f(.05),
        deltaX: -.22749999165534973, deltaY: .10999998450279236, deltaSize: -.07874999940395355,
        slowDown: f(.985), hue: 0, sat: 0, val: 1, alpha: f(.4), celebration: true},
      {x: -distance, y: -.42500001192092896, size: f(.05),
        deltaX: .22749999165534973, deltaY: .10999998450279236, deltaSize: -.07874999940395355,
        slowDown: f(.985), hue: 0, sat: 0, val: 1, alpha: f(.4), celebration: true},
    ]);
  });

  it.each([0, 1])("retains the inclusive source range endpoints for unit sample%s", sample => {
    const level = new Level(1);
    spawnHubCelebrationEdgeParticles(level, () => sample);
    const shrink = sample === 0 ? f(-.09) : f(-.045);
    const jitter = sample === 0 ? -f(.05) : f(.05);
    const tangent = sample === 0 ? -f(.22) : f(.22);
    const ySpeed = sample === 0 ? inwardYMin : f(.35);
    const xSpeed = sample === 0 ? inwardXMin : f(.35);
    for (let index = 0; index < 4; index++) {
      const along = f([-.375, -.125, .125, .375][index]! + jitter);
      const [yp, yn, xp, xn] = level.particles.slice(index * 4, index * 4 + 4);
      expect([yp!.x, yn!.x, xp!.y, xn!.y]).toEqual([along, along, along, along]);
      expect([yp!.deltaX, yp!.deltaY, yn!.deltaX, yn!.deltaY]).toEqual([tangent, -ySpeed, tangent, ySpeed]);
      expect([xp!.deltaX, xp!.deltaY, xn!.deltaX, xn!.deltaY]).toEqual([-xSpeed, tangent, xSpeed, tangent]);
      expect([yp!.deltaSize, yn!.deltaSize, xp!.deltaSize, xn!.deltaSize]).toEqual([shrink, shrink, shrink, shrink]);
    }
  });

  it("appends the current particle before its random calls and assigns fields in source order", () => {
    const level = new Level(1);
    const observations: Array<{count: number; particle: Particle}> = [];
    spawnHubCelebrationEdgeParticles(level, () => {
      observations.push({count: level.particles.length, particle: {...level.particles.at(-1)!}});
      return .5;
    });
    expect(observations).toHaveLength(64);
    observations.forEach((observation, index) => {
      expect(observation.count).toBe(Math.floor(index / 4) + 1);
      expect(observation.particle.slowDown).toBe(1);
      expect(observation.particle.celebration).toBe(true);
    });
    expect(observations[0]!.particle).toMatchObject({x: 0, y: 0, size: 0, deltaSize: 0});
    expect(observations[1]!.particle).toMatchObject({x: -.375, y: distance, size: f(.05), deltaSize: 0});
    expect(observations[2]!.particle.deltaSize).toBe(-.06750000268220901);
    expect(observations[8]!.particle).toMatchObject({x: distance, y: 0, size: 0});
    expect(observations[12]!.particle).toMatchObject({x: -distance, y: 0, size: 0});
  });

  it("does not depend on grid dimensions or modify side-selection bookkeeping", () => {
    const tiny = new Level(1, 1, 1), wide = new Level(9, 31, 7);
    tiny.lastPartSpawnSide = 2;
    wide.lastPartSpawnSide = 3;
    spawnHubCelebrationEdgeParticles(tiny, repeating([0, .25, .5, .75]));
    spawnHubCelebrationEdgeParticles(wide, repeating([0, .25, .5, .75]));
    expect(tiny.particles).toEqual(wide.particles);
    expect(tiny.lastPartSpawnSide).toBe(2);
    expect(wide.lastPartSpawnSide).toBe(3);
    expect([tiny.width, tiny.height, wide.width, wide.height]).toEqual([1, 1, 31, 7]);
  });

  it("uses the current Math.random as its default unit source", () => {
    const random = vi.spyOn(Math, "random").mockReturnValue(.5);
    try {
      const level = new Level(1);
      spawnHubCelebrationEdgeParticles(level);
      expect(random).toHaveBeenCalledTimes(64);
      expect(level.particles).toHaveLength(16);
    } finally {
      random.mockRestore();
    }
  });
});
