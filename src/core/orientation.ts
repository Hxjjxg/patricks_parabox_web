export type OrientationRotation = 0 | 1 | 2 | 3;

export interface LevelOrientation {
  readonly flipH: boolean;
  readonly rotation: OrientationRotation;
}

export interface OrientedCoordinate {
  readonly x: number;
  readonly y: number;
}

export type OrientationRandom = () => number;

export const identityOrientation: LevelOrientation = {
  flipH: false,
  rotation: 0,
};

function serializedBool(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function randomIndex(random: OrientationRandom, range: number): number {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
    throw new RangeError(`Orientation random sample must be in [0, 1), got ${sample}`);
  }
  return Math.floor(sample * range);
}

export function sourceHasFlippedBlock(source: string): boolean {
  for (const raw of source.replace(/\r\n?/g, "\n").split("\n")) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const tokens = trimmed.split(/\s+/);
    if (
      (tokens[0] === "Block" && serializedBool(tokens[14])) ||
      (tokens[0] === "Ref" && serializedBool(tokens[13]))
    ) {
      return true;
    }
  }
  return false;
}

export function chooseRandomOrientation(
  source: string,
  random: OrientationRandom = Math.random,
): LevelOrientation {
  const restrictToHalfTurns = sourceHasFlippedBlock(source);

  while (true) {
    const flipH = randomIndex(random, 2) !== 0;
    const rotationIndex = randomIndex(random, restrictToHalfTurns ? 2 : 4);
    const rotation = (
      restrictToHalfTurns ? rotationIndex * 2 : rotationIndex
    ) as OrientationRotation;
    if (flipH || rotation !== 0) return { flipH, rotation };
  }
}

export function transformLevelCoordinate(
  x: number,
  y: number,
  width: number,
  height: number,
  orientation: LevelOrientation,
): OrientedCoordinate {
  const mirroredX = orientation.flipH ? width - 1 - x : x;

  switch (orientation.rotation) {
    case 1:
      return { x: y, y: width - 1 - mirroredX };
    case 2:
      return { x: width - 1 - mirroredX, y: height - 1 - y };
    case 3:
      return { x: width - 1 - y, y: mirroredX };
    default:
      return { x: mirroredX, y };
  }
}
