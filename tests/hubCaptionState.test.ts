import {describe, expect, it} from "vitest";
import {advanceHubCaptionWall, advanceHubCelebrationClock, advanceHubPortalCelebration,
  createHubCaptionWallState, startHubCaptionCounting} from "../src/core/hubCaptionState";

const counts = {numRequired: 9, numSolved: 5, numSolvedUncapped: 5};
const portal = {celebrationIndex: 0, celebrationPopped: false, celebrationSizeT: 0};
const clock = {active: true, t: -1.25, playedStartSound: false, levelAttached: true};
const playing = {playing: true, unlocking: false, counting: false};

describe("source-only Hub wall caption lifecycle", () => {
  it("uses Block defaults and preserves counts outside rendering", () => {
    expect(createHubCaptionWallState(counts)).toEqual({...counts,
      counting: false, countingT: -2.5, countingTotalDelta: 0, countingDelta: 0,
      countingScaleT: 0, unlocking: false, unlockingT: 0, unlockingLength: 1.75,
      unlockingSuppressSound: false});
  });

  it("subtracts capped-away wins without clamping zero or negative deltas", () => {
    const state = createHubCaptionWallState({...counts, numSolved: 9, numSolvedUncapped: 11});
    const zero = startHubCaptionCounting(state, 2);
    expect(zero.counting).toBe(true);
    expect(zero.countingTotalDelta).toBe(0);
    expect(zero.countingDelta).toBe(0);
    const negative = startHubCaptionCounting(state, 1);
    expect(negative.countingTotalDelta).toBe(-1);
    expect(negative.countingDelta).toBe(-1);
    expect(negative.numSolved - negative.countingDelta).toBe(10);
    expect(negative.countingT).toBe(-2.5);
  });

  it("waits through the initial negative counting delay", () => {
    const state = startHubCaptionCounting(createHubCaptionWallState(counts), 2);
    const tick = advanceHubCaptionWall(state, .3, true);
    expect(tick.state.countingT).toBe(-1.5);
    expect(tick.state.countingDelta).toBe(2);
    expect(tick.countPop).toBeNull();
    expect(tick.worldCounting).toBe(true);
    expect(state.countingT).toBe(-2.5);
  });

  it("emits at most one pop even when several integer boundaries are crossed", () => {
    const state = {...startHubCaptionCounting(createHubCaptionWallState(counts), 4), countingT: .5};
    const tick = advanceHubCaptionWall(state, .9, true);
    expect(tick.state.countingT).toBeCloseTo(3.5, 5);
    expect(tick.state.countingDelta).toBe(3);
    expect(tick.countPop).toEqual({popT: .125, particles: 3, playSound: true});
    expect(tick.state.countingScaleT).toBe(0);
  });

  it("pops at equality, completes strictly after the total, and decays scale that same tick", () => {
    const state = {...startHubCaptionCounting(createHubCaptionWallState(counts), 1), countingT: .5};
    const first = advanceHubCaptionWall(state, .15, true);
    expect(first.state.countingT).toBe(1);
    expect(first.state.countingDelta).toBe(0);
    expect(first.state.countingScaleT).toBe(.25);
    expect(first.state.counting).toBe(true);
    expect(first.worldCounting).toBe(true);
    const equality = advanceHubCaptionWall(first.state, 0, true);
    expect(equality.state.counting).toBe(true);
    expect(equality.countPop).toBeNull();
    const finished = advanceHubCaptionWall(equality.state, .001, true);
    expect(finished.state.counting).toBe(false);
    expect(finished.worldCounting).toBe(false);
    expect(finished.state.countingDelta).toBe(0);
  });

  it("uses the pre-decrement pitch and the required-one special case", () => {
    const state = {...startHubCaptionCounting(createHubCaptionWallState({
      numRequired: 1, numSolved: 1, numSolvedUncapped: 1}), 1), countingT: .5};
    expect(advanceHubCaptionWall(state, .15, true).countPop?.popT).toBe(1);
  });

  it("global counting blocks unlocking until a later eligible wall update", () => {
    const state = {...startHubCaptionCounting(createHubCaptionWallState(counts, {unlocking: true}), 0),
      countingT: 0};
    const finished = advanceHubCaptionWall(state, .1, true);
    expect(finished.state.unlockingT).toBe(0);
    expect(finished.worldCounting).toBe(false);
    expect(finished.removed).toBe(false);
    const next = advanceHubCaptionWall(finished.state, .1, finished.worldCounting);
    expect(next.state.unlockingT).toBe(Math.fround(.1));
  });

  it("reports removal and twelve particles without resetting the removed block flag", () => {
    const state = {...createHubCaptionWallState(counts, {unlocking: true, unlockingSuppressSound: true}),
      unlockingT: Math.fround(1.7)};
    const tick = advanceHubCaptionWall(state, .1, false);
    expect(tick.removed).toBe(true);
    expect(tick.clearWorldUnlocking).toBe(true);
    expect(tick.unlockPop).toEqual({particles: 12, playSound: false});
    expect(tick.state.unlocking).toBe(true);
  });

  it("suppresses count sound while retaining the count particles and numerator change", () => {
    const state = {...startHubCaptionCounting(createHubCaptionWallState(counts,
      {unlockingSuppressSound: true}), 1), countingT: .5};
    const tick = advanceHubCaptionWall(state, .15, true);
    expect(tick.countPop).toEqual({popT: .5, particles: 3, playSound: false});
    expect(tick.state.numSolved - tick.state.countingDelta).toBe(5);
  });

  it("does not infer global counting from another wall", () => {
    const finishing = {...startHubCaptionCounting(createHubCaptionWallState(counts), 0), countingT: 0};
    const other = startHubCaptionCounting(createHubCaptionWallState(counts), 3);
    const tick = advanceHubCaptionWall(finishing, .1, true);
    expect(tick.worldCounting).toBe(false);
    expect(other.counting).toBe(true);
  });

  it("keeps decaying a residual wall pop after counting has finished", () => {
    const state = {...createHubCaptionWallState(counts), countingScaleT: 1};
    const tick = advanceHubCaptionWall(state, .1, false);
    expect(tick.state.counting).toBe(false);
    expect(tick.state.countingScaleT).toBe(.5);
    expect(tick.countPop).toBeNull();
  });
});

describe("source-only Hub celebration ordering", () => {
  it.each([
    {...playing, playing: false}, {...playing, unlocking: true}, {...playing, counting: true},
  ])("freezes the global clock behind its native gates %j", gates => {
    const tick = advanceHubCelebrationClock(clock, 1, gates);
    expect(tick.state).toEqual(clock);
    expect(tick.edgeParticleBurst).toBe(false);
    expect(tick.playBigPop).toBe(false);
  });

  it("marks the zero threshold and completes with one edge burst at3.25 seconds", () => {
    const started = advanceHubCelebrationClock({...clock, t: -.25}, .25, playing);
    expect(started.state.t).toBe(0);
    expect(started.state.playedStartSound).toBe(true);
    const completed = advanceHubCelebrationClock({...started.state, t: 3}, .25, playing);
    expect(completed.state).toEqual({active: false, t: 0, playedStartSound: true, levelAttached: false});
    expect(completed.edgeParticleBurst).toBe(true);
    expect(completed.playBigPop).toBe(true);
    expect(advanceHubCelebrationClock(completed.state, 1, playing).playBigPop).toBe(false);
  });

  it("uses the old celebration clock for floor pop eligibility", () => {
    const last = {...portal, celebrationIndex: 8};
    const before = advanceHubPortalCelebration(last, .02,
      {levelMatches: true, celebrationT: 2.59, celebrationNumLevels: 9});
    expect(before.pop).toBeNull();
    const advanced = advanceHubCelebrationClock({...clock, t: Math.fround(2.59)}, .02, playing);
    const after = advanceHubPortalCelebration(before.state, .02,
      {levelMatches: true, celebrationT: advanced.state.t, celebrationNumLevels: 9});
    expect(after.pop).toEqual({popT: 1, particles: 3});
    expect(after.state.celebrationSizeT).toBe(Math.fround(.02));
  });

  it("completes without a big pop if the source level pointer is already null", () => {
    const tick = advanceHubCelebrationClock({...clock, t: 3, levelAttached: false}, .25, playing);
    expect(tick.state.active).toBe(false);
    expect(tick.state.t).toBe(0);
    expect(tick.edgeParticleBurst).toBe(false);
    expect(tick.playBigPop).toBe(false);
  });

  it("allows portal pop and size growth while the paused global clock stays frozen", () => {
    const frozen = advanceHubCelebrationClock({...clock, t: 0}, .2, {...playing, playing: false});
    const context = {levelMatches: true, celebrationT: frozen.state.t, celebrationNumLevels: 9};
    const first = advanceHubPortalCelebration(portal, .2, context);
    expect(first.pop).toEqual({popT: 0, particles: 3});
    expect(first.state.celebrationSizeT).toBe(Math.fround(.2));
    const second = advanceHubPortalCelebration(first.state, .2, context);
    expect(second.pop).toBeNull();
    expect(second.state.celebrationSizeT).toBe(Math.fround(.4));
    const detached = advanceHubPortalCelebration(second.state, 1, {...context, levelMatches: false});
    expect(detached.state).toEqual(second.state);
  });

  it("preserves the source single-portal NaN pitch instead of adding a missing guard", () => {
    const tick = advanceHubPortalCelebration(portal, .1,
      {levelMatches: true, celebrationT: -1.25, celebrationNumLevels: 1});
    expect(tick.state.celebrationPopped).toBe(true);
    expect(Number.isNaN(tick.pop?.popT)).toBe(true);
  });
});
