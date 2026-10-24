import type { Block, Level, Phantom, WorldModel } from "./model";

/**
 * Procedural block animation, ported from the original game's
 * `Block.UpdateAnimation`, `Block.Do*Lerp`, `Projection` and `Util` helpers.
 * There are no Unity animation clips in Patrick's Parabox; every transition
 * below is a pure function of `animT / animLength`.
 */
export enum AnimType {
  Normal = "normal",
  EnterExit = "enterExit",
  Bump = "bump",
  BumpHalt = "bumpHalt",
  Nudge = "nudge",
  Still = "still",
  JumpIn = "jumpIn",
  JumpOut = "jumpOut",
  SquishInPlace = "squishInPlace",
}

export const EnterLengths = [0.5, 1 / 3, 0.25, 0.75] as const;
export const SlideLength = 0.1;
export const PossessLength = 0.33;
export const EnterSkipLength = 0.25;
export const UndoSquishLength = 0.125;
export const QuickAnimSquishLength = 0.6;
export const BumpLengthNormal = 0.22;
export const BumpLengthMulti = 0.11;

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Unity's `Mathf.Lerp` clamps t. */
export function lerp(from: number, to: number, t: number): number {
  const k = clamp01(t);
  return from + (to - from) * k;
}

/** Unity's `Mathf.SmoothStep` (Hermite interpolation, clamped). */
export function smoothStep(from: number, to: number, t: number): number {
  const k = clamp01(t);
  return from + (to - from) * (k * k * (3 - 2 * k));
}

export function smoothStepInOut(time: number): number {
  if (time < 0.5) return smoothStep(0, 1, time * 2);
  return smoothStep(0, 1, time * 2 - 1) * -1 + 1;
}

export function quadIn(k: number): number {
  return k * k;
}

export function quadOut(k: number): number {
  return k * (2 - k);
}

export function quadInOut(k: number): number {
  const j = k * 2;
  if (j < 1) return 0.5 * j * j;
  return -0.5 * ((j - 1) * (j - 2) - 1);
}

export function quadParabola(k: number): number {
  if (k < 0.5) return quadOut(2 * k);
  return quadOut(1 - (k - 0.5) * 2);
}

export function quartIn(k: number): number {
  return k * k * k * k;
}

/** Unity's `Mathf.Sign`: zero is positive. */
function sign(value: number): number {
  return value < 0 ? -1 : 1;
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

export interface AnimationContext {
  readonly deltaTime: number;
  /** `Draw.DrawStyle == DS.QUICK_ANIM`. */
  readonly quickAnim: boolean;
  /** Previous frame's `World.AnyBlockMoving`. */
  readonly anyBlockMoving: boolean;
  /** Mirrors `Block.HandleActionFloor()` (Break / Show / Gallery / FastTravel). */
  readonly handleActionFloor: (block: Block) => boolean;
  readonly random: () => number;
  /** `Projection.GetBumpLength()` for this frame. */
  readonly bumpLength?: number;
}

export interface AnimationSettings {
  readonly quickAnim: boolean;
  /** Index into `EnterLengths` (Prefs.EnterSpeedIndex). */
  readonly enterSpeedIndex: number;
}

export function getEnterLength(settings: AnimationSettings): number {
  if (settings.quickAnim) return 0.1;
  return EnterLengths[settings.enterSpeedIndex] ?? EnterLengths[0]!;
}

export function getPossessLength(settings: AnimationSettings): number {
  return getEnterLength(settings);
}

export function getBumpLength(world: WorldModel, settings: AnimationSettings): number {
  if (settings.quickAnim) return 0;
  if (world.playerBlocks.length >= 4) return BumpLengthMulti;
  return BumpLengthNormal;
}

export function stopMoving(block: Block): void {
  block.drawXOffset = 0;
  block.drawYOffset = 0;
  block.drawXScale = 1;
  block.drawYScale = 1;
  block.moving = false;
  block.fadeFlipH = false;
}

function doLerp(
  block: Block,
  x: number,
  y: number,
  xs: number,
  ys: number,
  time: number,
): void {
  block.drawXOffset = lerp(x, 0, time);
  block.drawYOffset = lerp(y, 0, time);
  block.drawXScale = lerp(xs, 1, time);
  block.drawYScale = lerp(ys, 1, time);
}

function doBasicOffsetsLerp(block: Block, time: number): void {
  doLerp(
    block,
    block.drawXOffsetStart,
    block.drawYOffsetStart,
    block.drawXScaleStart,
    block.drawYScaleStart,
    time,
  );
}

function doSquishLerp(
  block: Block,
  time: number,
  inPlace: boolean,
  quickAnim: boolean,
): void {
  let squash: number;
  let arc: number;
  if (inPlace) {
    block.drawXOffset = 0;
    block.drawYOffset = 0;
    squash = quickAnim ? 0.5 : 0.3;
    arc = quickAnim ? quartIn(1 - time) : quadIn(1 - time);
  } else {
    block.drawXOffset = lerp(block.drawXOffsetStart, 0, time);
    block.drawYOffset = lerp(block.drawYOffsetStart, 0, time);
    arc = quadParabola(time);
    squash = 0.2;
  }
  const narrow = lerp(1, 1 - squash, arc);
  const wide = lerp(1, 1 + squash / 2, arc);
  block.drawXScale = lerp(block.drawXScaleStart, 1, time);
  block.drawYScale = lerp(block.drawYScaleStart, 1, time);
  if (
    (block.drawXOffsetStart !== 0 && block.drawYOffsetStart === 0) ||
    (block.anim === AnimType.Nudge && block.drawNudgeHoriz)
  ) {
    block.drawXScale *= wide;
    block.drawYScale *= narrow;
    return;
  }
  if (
    (block.drawXOffsetStart === 0 && block.drawYOffsetStart !== 0) ||
    (block.anim === AnimType.Nudge && !block.drawNudgeHoriz)
  ) {
    block.drawXScale *= narrow;
    block.drawYScale *= wide;
  }
}

const IMMEDIATE_CONTEXT: Omit<AnimationContext, "anyBlockMoving"> = {
  deltaTime: 0,
  quickAnim: false,
  handleActionFloor: () => false,
  random: () => 0.5,
};

export function updateAnimation(
  block: Block,
  increment: boolean,
  incrementNonMovement: boolean,
  context: AnimationContext,
): void {
  const dt = context.deltaTime;
  if (block.moving && increment) {
    block.animT += dt;
  }
  if (
    block.moving &&
    block.animT > block.animLength &&
    block.anim !== AnimType.JumpIn
  ) {
    const finishedAnimation = block.anim;
    stopMoving(block);
    if (
      (finishedAnimation === AnimType.Normal ||
        finishedAnimation === AnimType.EnterExit ||
        finishedAnimation === AnimType.JumpOut) &&
      block.isPlayer &&
      !context.handleActionFloor(block) &&
      !context.quickAnim
    ) {
      let bumpX = 0;
      let bumpY = 0;
      if (Math.abs(block.drawXOffsetStart) > Math.abs(block.drawYOffsetStart)) {
        bumpX = -sign(block.drawXOffsetStart);
      } else {
        bumpY = sign(block.drawYOffsetStart);
      }
      block.smallBumpHalt = finishedAnimation === AnimType.EnterExit;
      doBumpAnim(block, bumpX, bumpY, true, context, context.bumpLength);
    }
  }

  if (block.moving) {
    block.lookAnimT = 0;
  }

  if (block.lookAnimT > 10) {
    block.lookAnimT = randomRange(context.random, 5, 7);
    if (
      (block.eyeXOffsetTo !== 0 || block.eyeYOffsetTo !== 0) &&
      context.random() < 0.5
    ) {
      block.eyeXOffsetTo = 0;
      block.eyeYOffsetTo = 0;
    } else {
      block.eyeXOffsetTo =
        randomRange(context.random, 0.04, 0.08) *
        (randomInt(context.random, 0, 2) * 2 - 1);
      block.eyeYOffsetTo =
        randomRange(context.random, 0.04, 0.08) *
        (randomInt(context.random, 0, 2) * 2 - 1);
    }
  }
  if (!block.drawIsPlayer) {
    block.eyeXOffsetTo = 0;
    block.eyeYOffsetTo = 0;
  }
  if (block.isPlayer || block.possessable) {
    const k = 13 * dt;
    block.eyeXOffset = lerp(block.eyeXOffset, block.eyeXOffsetTo, k);
    block.eyeYOffset = lerp(block.eyeYOffset, block.eyeYOffsetTo, k);
  }

  if (block.moving) {
    switch (block.anim) {
      case AnimType.Normal: {
        doSquishLerp(
          block,
          block.animT / block.animLength,
          false,
          context.quickAnim,
        );
        break;
      }
      case AnimType.EnterExit: {
        const t = block.animT / block.animLength;
        const entered = block.justEnteredArray?.[0];
        if (entered && entered.moving && entered.anim === AnimType.EnterExit) {
          let x = block.drawXOffsetStart;
          let y = block.drawYOffsetStart;
          let xs = block.drawXScaleStart;
          let ys = block.drawYScaleStart;
          xs /= entered.drawXScale;
          ys /= entered.drawYScale;
          const enteredLevel = entered.subLevel;
          if (enteredLevel) {
            if (block.drawXOffsetStart !== 0) {
              x +=
                sign(block.drawXOffsetStart) *
                (-enteredLevel.width / 2 + xs / 2);
            } else {
              y +=
                sign(block.drawYOffsetStart) *
                (-enteredLevel.height / 2 + ys / 2);
            }
          }
          doLerp(block, x, y, xs, ys, t);
        } else {
          doBasicOffsetsLerp(block, t);
        }
        break;
      }
      case AnimType.Nudge: {
        doSquishLerp(
          block,
          block.animT / block.animLength,
          false,
          context.quickAnim,
        );
        break;
      }
      case AnimType.Still: {
        doBasicOffsetsLerp(block, 1);
        break;
      }
      case AnimType.Bump:
      case AnimType.BumpHalt: {
        const t = smoothStepInOut(block.animT / block.animLength);
        let amount = 0.2;
        if (block.anim === AnimType.BumpHalt) {
          amount = block.smallBumpHalt ? 0.05 : 0.1;
        }
        const travel = lerp(0, amount / 2, t);
        const narrow = lerp(1, 1 - amount, t);
        const wide = lerp(1, 1 + amount / 2, t);
        if (block.drawXOffsetStart !== 0) {
          block.drawXOffset = travel * block.drawXOffsetStart;
          block.drawYOffset = 0;
          block.drawXScale = narrow;
          block.drawYScale = wide;
        } else {
          block.drawXOffset = 0;
          block.drawYOffset = travel * block.drawYOffsetStart;
          block.drawXScale = wide;
          block.drawYScale = narrow;
        }
        break;
      }
      case AnimType.JumpIn: {
        const t = Math.min(block.animT / block.animLength, 1);
        block.drawXOffset = lerp(0, block.drawXOffsetStart, t);
        block.drawYOffset =
          lerp(0, block.drawYOffsetStart, t) -
          (-Math.pow(2 * t - 1, 2) + 1);
        block.drawXScale = lerp(1, block.drawXScaleStart, t);
        block.drawYScale = lerp(1, block.drawYScaleStart, t);
        break;
      }
      case AnimType.JumpOut: {
        const t = block.animT / block.animLength;
        block.drawXOffset = lerp(0, block.drawXOffsetStart, 1 - t);
        block.drawYOffset =
          lerp(0, block.drawYOffsetStart, 1 - t) -
          (-Math.pow(2 * t - 1, 2) + 1);
        block.drawXScale = lerp(1, 0.15, 1 - t);
        block.drawYScale = block.drawXScale;
        break;
      }
      case AnimType.SquishInPlace: {
        doSquishLerp(
          block,
          block.animT / block.animLength,
          true,
          context.quickAnim,
        );
        break;
      }
      default:
        break;
    }
  }

  if (incrementNonMovement) {
    block.faceAnimT += dt;
    block.miscAnimT += dt;
    if (block.isPlayer && !context.anyBlockMoving) {
      block.lookAnimT += dt;
    }
  }

  if (!block.moving) {
    block.drawIsPlayer = block.isPlayer;
  }
}

export function doBumpAnim(
  block: Block,
  dx: number,
  dy: number,
  halt: boolean,
  context: Pick<AnimationContext, "quickAnim">,
  length = BumpLengthNormal,
): void {
  block.moving = true;
  block.anim = halt ? AnimType.BumpHalt : AnimType.Bump;
  block.animT = 0;
  block.animLength = length;
  block.drawXScaleStart = 1;
  block.drawYScaleStart = 1;
  block.drawXOffsetStart = dx;
  block.drawYOffsetStart = -dy;
  if (context.quickAnim) {
    doSquishInPlace(block, dx !== 0, QuickAnimSquishLength, context);
  }
}

export function doNudgeAnim(block: Block, horiz: boolean, length: number): void {
  block.moving = true;
  block.anim = AnimType.Nudge;
  block.animT = 0;
  block.animLength = length;
  block.drawXScaleStart = 1;
  block.drawYScaleStart = 1;
  block.drawXOffsetStart = 0;
  block.drawYOffsetStart = 0;
  block.drawNudgeHoriz = horiz;
}

export function doPossessAnim(
  block: Block,
  dx: number,
  dy: number,
  context: Pick<AnimationContext, "quickAnim">,
  length: number,
): void {
  doBumpAnim(block, dx, dy, false, context);
  block.animLength = length;
}

export function doStillPossessAnim(block: Block, length: number): void {
  block.moving = true;
  block.anim = AnimType.Still;
  block.animT = 0;
  block.animLength = length;
}

export function doSquishInPlace(
  block: Block,
  horiz: boolean,
  length: number,
  context: Pick<AnimationContext, "quickAnim">,
): void {
  block.anim = AnimType.SquishInPlace;
  block.drawXOffsetStart = horiz ? 1 : 0;
  block.drawYOffsetStart = horiz ? 0 : 1;
  block.drawXScaleStart = 1;
  block.drawYScaleStart = 1;
  block.animLength = length;
  block.animT = 0;
  block.moving = true;
  updateAnimation(block, false, false, {
    ...IMMEDIATE_CONTEXT,
    quickAnim: context.quickAnim,
    anyBlockMoving: true,
  });
}

export function doAnim(
  block: Block,
  x: number,
  y: number,
  xs: number,
  ys: number,
  animLength: number,
  context: Pick<AnimationContext, "quickAnim">,
): void {
  block.anim = xs !== 1 || ys !== 1 ? AnimType.EnterExit : AnimType.Normal;
  block.drawXOffsetStart = x;
  block.drawYOffsetStart = y;
  block.drawXScaleStart = xs;
  block.drawYScaleStart = ys;
  block.animLength = animLength;
  block.animT = 0;
  block.moving = true;
  updateAnimation(block, false, false, {
    ...IMMEDIATE_CONTEXT,
    quickAnim: context.quickAnim,
    anyBlockMoving: true,
  });
}

export function isAnimatedBlock(block: Block): boolean {
  return Boolean(block.subLevel || block.isPlayer || block.possessable);
}

/** Mirrors the tail of `World.UpdateInner`'s AnyBlockMoving scan. */
export function computeAnyBlockMoving(world: WorldModel): boolean {
  for (const block of world.blocks) {
    if (
      isAnimatedBlock(block) &&
      block.moving &&
      block.anim !== AnimType.BumpHalt &&
      block.anim !== AnimType.SquishInPlace
    ) {
      return true;
    }
  }
  return false;
}

export function stopAllAnimations(world: WorldModel): void {
  for (const block of world.blocks) {
    if (isAnimatedBlock(block)) stopMoving(block);
  }
  world.anyBlockMoving = false;
}

export function updatePhantoms(world: WorldModel, deltaTime: number): void {
  for (const level of world.levels) {
    for (let index = level.phantoms.length - 1; index >= 0; index--) {
      const phantom = level.phantoms[index]!;
      phantom.animT += deltaTime;
      const t = Math.min(phantom.animT / phantom.animLength, 1);
      phantom.x = lerp(phantom.xFrom, phantom.xTo, t);
      phantom.y = lerp(phantom.yFrom, phantom.yTo, t);
      phantom.xScale = lerp(phantom.xScaleFrom, phantom.xScaleTo, t);
      phantom.yScale = lerp(phantom.yScaleFrom, phantom.yScaleTo, t);
      if (phantom.animT >= phantom.animLength) {
        level.phantoms.splice(index, 1);
      }
    }
  }
}

/** Advances every block (and phantom) the way `World.UpdateInner` does. */
export function updateWorldAnimations(
  world: WorldModel,
  context: Omit<AnimationContext, "anyBlockMoving" | "bumpLength">,
): void {
  const fullContext: AnimationContext = {
    ...context,
    anyBlockMoving: world.anyBlockMoving,
    bumpLength: context.quickAnim
      ? 0
      : world.playerBlocks.length >= 4
        ? BumpLengthMulti
        : BumpLengthNormal,
  };
  for (const block of world.blocks) {
    if (!isAnimatedBlock(block)) continue;
    updateAnimation(block, true, true, fullContext);
  }
  for (const block of world.blocks) {
    if (!isAnimatedBlock(block)) continue;
    updateAnimation(block, false, false, fullContext);
  }
  updatePhantoms(world, context.deltaTime);
  world.anyBlockMoving = computeAnyBlockMoving(world);
}

// ---------------------------------------------------------------------------
// Projection: turns the recursive attempt chain into a start offset/scale.
// ---------------------------------------------------------------------------

export interface ProjectionMove {
  readonly moveType: string;
  readonly fromLevel: Level | null;
  readonly fromLevelBlock: Block | null;
  readonly fromX: number;
  readonly fromY: number;
  readonly toLevel: Level;
  readonly toLevelBlock: Block;
  readonly toX: number;
  readonly toY: number;
  readonly dx: number;
  readonly dy: number;
  readonly shed: boolean;
  readonly infExitNum: number;
  readonly infEnterNum: number;
  readonly infEnterSourceBlock: Block | null;
}

export interface ProjectionResult {
  xScale: number;
  yScale: number;
  xOffset: number;
  yOffset: number;
}

/** The attempt chain also carries the moving block; expose it structurally. */
export type ProjectionMoveWithBlock = ProjectionMove & { readonly block: Block };

function movesFor(
  moves: readonly ProjectionMoveWithBlock[],
  block: Block,
): ProjectionMoveWithBlock[] {
  return moves.filter((move) => move.block === block);
}

export function computeProjection(
  moves: readonly ProjectionMoveWithBlock[],
  block: Block,
): ProjectionResult {
  const list = movesFor(moves, block);
  if (list.length === 1 && list[0]!.moveType === "slide") {
    return {
      xScale: 1,
      yScale: 1,
      xOffset: -list[0]!.dx,
      yOffset: list[0]!.dy,
    };
  }
  const filtered = list.filter((move) => move.moveType !== "slide");
  let dx = 0;
  let dy = 0;
  let xscale = 1;
  let yscale = 1;
  let flip = 1;
  for (let index = filtered.length - 1; index >= 0; index--) {
    const move = filtered[index]!;
    if (move.moveType === "enter") {
      if (move.dx !== 0) {
        dx = ((xscale * move.toLevel.width + 1) / 2) * flip * -move.dx;
        if (move.toLevelBlock.flipH) flip *= -1;
        dy += (move.toY - (move.toLevel.height - 1) / 2) * yscale;
      } else if (move.dy !== 0) {
        dy = move.dy * ((yscale * move.toLevel.height + 1) / 2);
        dx += -(move.toX - (move.toLevel.width - 1) / 2) * xscale * flip;
        if (move.toLevelBlock.flipH) flip *= -1;
      }
      xscale *= move.toLevel.width;
      yscale *= move.toLevel.height;
    } else if (move.moveType === "exit") {
      const fromLevel = move.fromLevel;
      const fromBlock = move.fromLevelBlock;
      if (!fromLevel || !fromBlock) continue;
      xscale /= fromLevel.width;
      yscale /= fromLevel.height;
      if (move.dx !== 0) {
        dx =
          -move.dx *
          (move.shed ? -0.5 + xscale / 2 : 0.5 + xscale / 2) *
          flip;
        if (fromBlock.flipH) flip *= -1;
        dy += -(move.fromY - (fromLevel.height - 1) / 2) * yscale;
      } else if (move.dy !== 0) {
        dy = move.dy * (move.shed ? -0.5 + yscale / 2 : 0.5 + yscale / 2);
        if (fromBlock.flipH) flip *= -1;
        dx += (move.fromX - (fromLevel.width - 1) / 2) * xscale * flip;
      }
    }
  }
  return { xScale: xscale, yScale: yscale, xOffset: dx, yOffset: dy };
}

export function computeProjectionParent(
  moves: readonly ProjectionMoveWithBlock[],
  block: Block,
): ProjectionResult {
  const list = movesFor(moves, block);
  if (list.length === 1 && list[0]!.moveType === "slide") {
    return { xScale: 1, yScale: 1, xOffset: 0, yOffset: 0 };
  }
  const filtered = list.filter((move) => move.moveType !== "slide");
  let dx = 0;
  let dy = 0;
  let xscale = 1;
  let yscale = 1;
  let flip = 1;
  for (let index = filtered.length - 1; index >= 0; index--) {
    const move = filtered[index]!;
    if (move.moveType === "enter") {
      let levelBlock = move.toLevelBlock;
      const exitBlock = move.toLevel.getExitBlock();
      if (
        move.infEnterNum !== -1 &&
        exitBlock.outerLevel &&
        exitBlock.outerLevel.infZone
      ) {
        levelBlock = move.infEnterSourceBlock ?? levelBlock;
      }
      if (levelBlock.flipH) flip *= -1;
      const fromLevel = move.fromLevel ?? move.toLevel;
      dx += (levelBlock.x - (fromLevel.width - 1) / 2) / xscale * flip;
      dy -= (levelBlock.y - (fromLevel.height - 1) / 2) / yscale;
      xscale /= fromLevel.width;
      yscale /= fromLevel.height;
    } else if (move.moveType === "exit") {
      const fromBlock = move.fromLevelBlock;
      const fromLevel = move.fromLevel;
      if (!fromBlock || !fromLevel) continue;
      xscale *= move.toLevel.width;
      yscale *= move.toLevel.height;
      dx -= (fromBlock.x - (move.toLevel.width - 1) / 2) / xscale * flip;
      dy += (fromBlock.y - (move.toLevel.height - 1) / 2) / yscale;
      if (fromLevel.getExitBlock().flipH) flip *= -1;
    }
  }
  const first = filtered[0];
  if (first?.fromLevel) {
    xscale *= first.fromLevel.camZoomFactor;
    yscale *= first.fromLevel.camZoomFactor;
  }
  return { xScale: xscale, yScale: yscale, xOffset: dx, yOffset: dy };
}

/**
 * `Projection.ComputeAnimLength`. The original returns the enter length when
 * the chain nets out to an enter/exit imbalance; we return a marker (-1) and
 * let the caller substitute the configured enter length.
 */
export function computeAnimLength(
  moves: readonly ProjectionMoveWithBlock[],
  enterLength: number,
): number {
  const depth = new Map<Block, number>();
  for (const move of moves) {
    if (move.moveType === "enter") {
      depth.set(move.block, (depth.get(move.block) ?? 0) + 1);
    } else if (move.moveType === "exit") {
      depth.set(move.block, (depth.get(move.block) ?? 0) - 1);
    }
  }
  for (const value of depth.values()) {
    if (value !== 0) return enterLength;
  }
  if (depth.size > 0) return enterLength;
  return SlideLength;
}

// ---------------------------------------------------------------------------
// Camera animation: ported from Draw.SetCameraOffset / ResetCameraOffset.
// ---------------------------------------------------------------------------

export function resetCameraOffset(world: WorldModel): void {
  world.cameraMoving = false;
  world.cameraAnimT = 0;
  world.cameraAnimLength = 0;
  world.newCamT = 1;
  world.newX = 0;
  world.newY = 0;
  world.newXS = 1;
  world.newYS = 1;
  world.usedX = 0;
  world.usedY = 0;
  world.usedXS = 1;
  world.usedYS = 1;
}

export function setCameraOffset(
  world: WorldModel,
  dx: number,
  dy: number,
  dxScale: number,
  dyScale: number,
  animLength: number,
  changedFlipH: boolean,
): void {
  world.cameraMoving = true;
  world.cameraAnimT = 0;
  world.cameraAnimLength = animLength;
  if (dxScale === 1 && dyScale === 1 && dx === 0 && dy === 0) return;
  world.newCamT = 0;
  if (changedFlipH) world.usedX *= -1;
  world.usedX /= dxScale;
  world.usedY /= dyScale;
  world.usedX += dx;
  world.usedY += dy;
  world.usedXS *= dxScale;
  world.usedYS *= dyScale;
  world.newX = world.usedX;
  world.newY = world.usedY;
  world.newXS = world.usedXS;
  world.newYS = world.usedYS;
}

export function updateCameraAnimation(world: WorldModel, deltaTime: number): void {
  if (world.cameraMoving) {
    world.cameraAnimT += deltaTime;
    if (world.cameraAnimT >= world.cameraAnimLength) {
      world.cameraMoving = false;
      world.cameraAnimT = world.cameraAnimLength;
    }
  }
  if (world.newCamT < 1) {
    world.newCamT = Math.min(
      1,
      world.newCamT + deltaTime / Math.max(world.cameraAnimLength, 1e-6),
    );
  }
}

export function makePhantom(
  block: Block,
  outerLevel: Level,
  xpos: number,
  ypos: number,
  animLength: number,
): Phantom {
  return {
    block,
    xpos,
    ypos,
    outerLevel,
    exitedFrom: null,
    face: false,
    faceBlockForJustEnteredArray: null,
    jumpIn: false,
    jumpOut: false,
    animT: 0,
    animLength,
    x: 0,
    xFrom: 0,
    xTo: 0,
    y: 0,
    yFrom: 0,
    yTo: 0,
    xScale: 1,
    xScaleFrom: 1,
    xScaleTo: 1,
    yScale: 1,
    yScaleFrom: 1,
    yScaleTo: 1,
    exiting: false,
    exitingDX: 0,
    exitingDY: 0,
  };
}
