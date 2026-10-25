import type {Level, Particle} from "./model";

/**
 * Float-range adapter for an injected unit sample. This preserves source range
 * bounds/call order; Math.random is not a port of Unity's internal PRNG.
 */
function range(random: () => number, min: number, max: number): number {
  const f = Math.fround;
  return f(f(min) + f(f(f(max) - f(min)) * f(random())));
}

/** Particle.CreateCelebrationEdgeParticle: add before consuming any random value. */
function createParticle(level: Level): Particle {
  const particle: Particle = {
    x: 0, y: 0, size: 0, deltaX: 0, deltaY: 0, deltaSize: 0, slowDown: 1,
    hue: 0, sat: 0, val: 1, alpha: Math.fround(.4), celebration: true,
  };
  level.particles.push(particle);
  return particle;
}

/**
 * Particle.cs424–486: four stations, each +Y, -Y, +X, -X, sixteen particles.
 * Consumes exactly64 unit samples: jitter, shrink, deltaX, deltaY per particle.
 * Coordinates are fractions of the level, not grid-cell or screen coordinates.
 */
export function spawnHubCelebrationEdgeParticles(
  level: Level, random: () => number = Math.random,
): void {
  const f = Math.fround;
  const size = f(.05), jitter = f(.05), distance = f(f(.5) + f(size * f(.3)));
  const shrinkMin = f(-.09), shrinkMax = f(-.045), tangent = f(.22), inwardMax = f(.35);
  const inwardYMin = f(inwardMax * f(.2)), inwardXMin = f(inwardMax * f(.3));
  for (let station = 0; station < 4; station++) {
    const along = f(f(f(f(station) + f(.5)) / f(4)) - f(.5));

    const positiveY = createParticle(level);
    positiveY.x = f(along + range(random, -jitter, jitter));
    positiveY.y = distance;
    positiveY.size = size;
    positiveY.deltaSize = range(random, shrinkMin, shrinkMax);
    positiveY.deltaX = range(random, -tangent, tangent);
    positiveY.deltaY = f(-range(random, inwardYMin, inwardMax));
    positiveY.slowDown = f(.985);

    const negativeY = createParticle(level);
    negativeY.x = f(along + range(random, -jitter, jitter));
    negativeY.y = f(-distance);
    negativeY.size = size;
    negativeY.deltaSize = range(random, shrinkMin, shrinkMax);
    negativeY.deltaX = range(random, -tangent, tangent);
    negativeY.deltaY = range(random, inwardYMin, inwardMax);
    negativeY.slowDown = f(.985);

    const positiveX = createParticle(level);
    positiveX.x = distance;
    positiveX.y = f(along + range(random, -jitter, jitter));
    positiveX.size = size;
    positiveX.deltaSize = range(random, shrinkMin, shrinkMax);
    positiveX.deltaX = f(-range(random, inwardXMin, inwardMax));
    positiveX.deltaY = range(random, -tangent, tangent);
    positiveX.slowDown = f(.985);

    const negativeX = createParticle(level);
    negativeX.x = f(-distance);
    negativeX.y = f(along + range(random, -jitter, jitter));
    negativeX.size = size;
    negativeX.deltaSize = range(random, shrinkMin, shrinkMax);
    negativeX.deltaX = range(random, inwardXMin, inwardMax);
    negativeX.deltaY = range(random, -tangent, tangent);
    negativeX.slowDown = f(.985);
  }
}
