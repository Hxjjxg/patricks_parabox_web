/** Source mechanisms only. The caller owns native World update ordering and effects. */
export interface HubCaptionCounts {
  readonly numRequired: number;
  readonly numSolved: number;
  readonly numSolvedUncapped: number;
}

export interface HubCaptionWallState extends HubCaptionCounts {
  readonly counting: boolean;
  readonly countingT: number;
  readonly countingTotalDelta: number;
  readonly countingDelta: number;
  readonly countingScaleT: number;
  readonly unlocking: boolean;
  readonly unlockingT: number;
  readonly unlockingLength: number;
  readonly unlockingSuppressSound: boolean;
}

/** Block field defaults; counts are already initialized by LoadLevel. */
export function createHubCaptionWallState(
  counts: HubCaptionCounts,
  options: { readonly unlocking?: boolean; readonly unlockingSuppressSound?: boolean } = {},
): HubCaptionWallState {
  return {...counts, counting: false, countingT: -2.5, countingTotalDelta: 0,
    countingDelta: 0, countingScaleT: 0, unlocking: options.unlocking ?? false,
    unlockingT: 0, unlockingLength: Math.fround(1.75),
    unlockingSuppressSound: options.unlockingSuppressSound ?? false};
}

/** LoadLevel1290–1303, only for a qualifying retained recent-area ordinary wall. */
export function startHubCaptionCounting(
  state: HubCaptionWallState, levelsNewlyWon: number,
): HubCaptionWallState {
  const delta = levelsNewlyWon - (state.numSolvedUncapped - state.numSolved);
  return {...state, counting: true, countingTotalDelta: delta, countingDelta: delta};
}

function nativeDelta(deltaTime: number): number {
  const dt = Math.fround(deltaTime);
  if (!Number.isFinite(dt) || dt < 0) throw new RangeError("Expected a finite nonnegative native deltaTime");
  return dt;
}

export interface HubCaptionWallTick {
  readonly state: HubCaptionWallState;
  /** Preserve native per-wall assignment; do not recompute from all wall states. */
  readonly worldCounting: boolean;
  readonly clearWorldUnlocking: boolean;
  readonly removed: boolean;
  readonly countPop: {readonly popT: number; readonly particles: 3; readonly playSound: boolean} | null;
  readonly unlockPop: {readonly particles: 12; readonly playSound: boolean} | null;
}

/**
 * Block489–551: UpdateUnlocking then UpdateCounting on the SAME local block.
 * Call only in the eligible playing block loop, never its skipped first Hub frame.
 * A removal also mutates native blocks during forward iteration: caller must match it.
 */
export function advanceHubCaptionWall(
  previous: HubCaptionWallState, deltaTime: number, worldCounting: boolean,
): HubCaptionWallTick {
  const dt = nativeDelta(deltaTime), f = Math.fround;
  let {unlockingT, countingT, counting, countingDelta, countingScaleT} = previous;
  let removed = false;
  let countPop: HubCaptionWallTick["countPop"] = null;
  let unlockPop: HubCaptionWallTick["unlockPop"] = null;
  if (previous.unlocking && !worldCounting) {
    unlockingT = f(unlockingT + dt);
    if (unlockingT >= previous.unlockingLength) {
      removed = true;
      unlockPop = {particles: 12, playSound: !previous.unlockingSuppressSound};
    }
  }
  if (counting) {
    countingT = f(countingT + f(dt / f(.3)));
    if (countingT >= 1 && Math.floor(previous.countingT) !== Math.floor(countingT)) {
      const popT = previous.numRequired === 1 ? 1
        : f(f(previous.numSolved - countingDelta) / f(previous.numRequired - 1));
      countPop = {popT, particles: 3, playSound: !previous.unlockingSuppressSound};
      countingScaleT = 1;
      countingDelta--;
    }
    if (countingT > f(previous.countingTotalDelta)) {
      counting = false;
      worldCounting = false;
    }
  }
  if (countingScaleT > 0) {
    countingScaleT = f(countingScaleT - f(dt / f(.2)));
    if (countingScaleT < 0) countingScaleT = 0;
  }
  return {state: {...previous, unlockingT, countingT, counting, countingDelta, countingScaleT},
    worldCounting, clearWorldUnlocking: removed, removed, countPop, unlockPop};
}

export interface HubCelebrationClock {
  readonly active: boolean;
  readonly t: number;
  readonly playedStartSound: boolean;
  /** Native celebrationLevel != null; identity remains with the caller. */
  readonly levelAttached: boolean;
}

/** World1240–1258. Called AFTER eligible floor animation and win/load logic. */
export function advanceHubCelebrationClock(
  previous: HubCelebrationClock, deltaTime: number,
  gates: {readonly playing: boolean; readonly unlocking: boolean; readonly counting: boolean},
): {readonly state: HubCelebrationClock; readonly edgeParticleBurst: boolean; readonly playBigPop: boolean} {
  const dt = nativeDelta(deltaTime), f = Math.fround;
  if (!gates.playing || !previous.active || gates.unlocking || gates.counting) {
    return {state: {...previous}, edgeParticleBurst: false, playBigPop: false};
  }
  const t = f(previous.t + dt), complete = t >= f(3.25);
  const burst = complete && previous.levelAttached;
  return {state: {...previous, t: complete ? 0 : t, active: !complete,
    playedStartSound: previous.playedStartSound || t >= 0,
    levelAttached: complete ? false : previous.levelAttached},
    edgeParticleBurst: burst, playBigPop: burst};
}

export interface HubPortalCelebrationState {
  readonly celebrationIndex: number;
  readonly celebrationPopped: boolean;
  readonly celebrationSizeT: number;
}

/**
 * Floor201–215: runs in both playing and paused floor loops, BEFORE the clock.
 * Matching level identity alone gates it; global celebration/count/unlock flags do not.
 */
export function advanceHubPortalCelebration(
  previous: HubPortalCelebrationState, deltaTime: number,
  context: {readonly levelMatches: boolean; readonly celebrationT: number; readonly celebrationNumLevels: number},
): {readonly state: HubPortalCelebrationState;
  readonly pop: {readonly popT: number; readonly particles: 3} | null} {
  const dt = nativeDelta(deltaTime), f = Math.fround;
  if (!context.levelMatches) return {state: {...previous}, pop: null};
  let {celebrationPopped, celebrationSizeT} = previous;
  let pop: {readonly popT: number; readonly particles: 3} | null = null;
  const intervals = f(context.celebrationNumLevels - 1);
  if (!celebrationPopped && f(f(f(context.celebrationT) / f(2.6)) * intervals) >= f(previous.celebrationIndex)) {
    celebrationPopped = true;
    pop = {popT: f(f(previous.celebrationIndex) / intervals), particles: 3};
  }
  if (celebrationPopped) celebrationSizeT = f(celebrationSizeT + dt);
  return {state: {...previous, celebrationPopped, celebrationSizeT}, pop};
}
