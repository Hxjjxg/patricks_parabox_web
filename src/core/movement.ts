import {
  Attempt,
  Block,
  Floor,
  FloorType,
  Level,
  WorldModel,
} from "./model";

export enum MoveType {
  Slide = "slide",
  Enter = "enter",
  Exit = "exit",
}

interface AttemptMove {
  block: Block;
  moveType: MoveType;
  fromLevel: Level | null;
  fromLevelBlock: Block | null;
  fromX: number;
  fromY: number;
  toLevel: Level;
  toLevelBlock: Block;
  toX: number;
  toY: number;
  dx: number;
  dy: number;
  infExitNum: number;
  shed: boolean;
  infEnterNum: number;
  infEaten: boolean;
  infEnterSourceBlock: Block | null;
}

export interface TurnMove {
  block: Block;
  fromLevel: Level;
  fromX: number;
  fromY: number;
  fromFlipH: boolean;
  toLevel: Level;
  toX: number;
  toY: number;
  toFlipH: boolean;
  dx: number;
  dy: number;
  nudge: boolean;
  movedSinceRestart: boolean;
}

export interface PlayerSwitch {
  from: Block;
  to: Block;
  order: number;
  orderBackup: number;
  dx: number;
  dy: number;
}

export interface Turn {
  moves: TurnMove[];
  playerSwitches: PlayerSwitch[];
  fromCameraFlipH: boolean;
  toCameraFlipH: boolean;
  wentToInfZoneChanged: boolean;
  isRestart: boolean;
  moveCount: number;
}

export interface ImpulseResult {
  moved: boolean;
  won: boolean;
  possessed: boolean;
  turn: Turn | null;
  transition: PortalTransition | null;
}

export interface PortalTransition {
  readonly floor: Floor;
  readonly block: Block;
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  readonly dx: number;
  readonly dy: number;
}

function createTurn(cameraFlipH: boolean): Turn {
  return {
    moves: [],
    playerSwitches: [],
    fromCameraFlipH: cameraFlipH,
    toCameraFlipH: cameraFlipH,
    wentToInfZoneChanged: false,
    isRestart: false,
    moveCount: 0,
  };
}

function assertOuterLevel(block: Block): Level {
  if (!block.outerLevel) {
    throw new Error(`Block ${block.id} is not placed in a level`);
  }
  return block.outerLevel;
}

function sameAttemptMove(a: AttemptMove, b: AttemptMove): boolean {
  return (
    a.block === b.block &&
    a.moveType === b.moveType &&
    a.fromLevel === b.fromLevel &&
    a.fromLevelBlock === b.fromLevelBlock &&
    a.fromX === b.fromX &&
    a.fromY === b.fromY &&
    a.toLevel === b.toLevel &&
    a.toLevelBlock === b.toLevelBlock &&
    a.toX === b.toX &&
    a.toY === b.toY &&
    a.dx === b.dx &&
    a.dy === b.dy &&
    a.infExitNum === b.infExitNum &&
    a.shed === b.shed &&
    a.infEnterNum === b.infEnterNum &&
    a.infEaten === b.infEaten &&
    a.infEnterSourceBlock === b.infEnterSourceBlock
  );
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * clamp01(t);
}

function inverseLerp(from: number, to: number, value: number): number {
  if (from === to) return 0;
  return clamp01((value - from) / (to - from));
}

export class History {
  readonly world: WorldModel;
  readonly past: Turn[] = [];
  readonly future: Turn[] = [];
  currentTurn: Turn;

  constructor(world: WorldModel) {
    this.world = world;
    this.currentTurn = createTurn(world.cameraFlipH);
  }

  beginTurn(): void {
    this.currentTurn = createTurn(this.world.cameraFlipH);
  }

  discardTurn(): void {
    this.currentTurn = createTurn(this.world.cameraFlipH);
  }

  registerMove(move: TurnMove): void {
    this.currentTurn.moves.push(move);
  }

  registerPlayerSwitch(from: Block, to: Block, dx: number, dy: number): void {
    this.currentTurn.playerSwitches.push({
      from,
      to,
      order: from.playerOrder,
      orderBackup: to.playerOrder,
      dx,
      dy,
    });
  }

  registerWentToInfZone(): void {
    this.currentTurn.wentToInfZoneChanged = true;
  }

  registerCameraFlip(): void {
    this.currentTurn.toCameraFlipH = !this.world.cameraFlipH;
  }

  commit(moveCount: number): Turn {
    this.world.moveCount = moveCount;
    this.currentTurn.moveCount = moveCount;
    const turn = this.currentTurn;
    this.future.length = 0;
    this.past.push(turn);
    this.applyTurn(turn, true);
    this.currentTurn = createTurn(this.world.cameraFlipH);
    return turn;
  }

  undo(): boolean {
    const moveCount = this.past.at(-1)?.moveCount;
    if (moveCount === undefined) return false;
    while (this.past.at(-1)?.moveCount === moveCount) {
      const turn = this.past.pop();
      if (!turn) break;
      this.future.push(turn);
      this.applyTurn(turn, false);
    }
    this.world.moveCount = this.past.at(-1)?.moveCount ?? 0;
    return true;
  }

  redo(): boolean {
    const moveCount = this.future.at(-1)?.moveCount;
    if (moveCount === undefined) return false;
    while (this.future.at(-1)?.moveCount === moveCount) {
      const turn = this.future.pop();
      if (!turn) break;
      this.past.push(turn);
      this.applyTurn(turn, true);
    }
    this.world.moveCount = moveCount;
    return true;
  }

  restart(): boolean {
    if (this.past.length === 0 || this.past.at(-1)?.isRestart) return false;

    const turn = createTurn(this.world.cameraFlipH);
    turn.isRestart = true;
    turn.moveCount = 0;
    turn.toCameraFlipH = false;
    turn.wentToInfZoneChanged = this.world.wentToInfZone;

    for (const block of this.world.blocks) {
      if (
        block.startIsPlayer &&
        (!block.isPlayer || block.playerOrder !== block.startPlayerOrder)
      ) {
        const currentPlayer = this.world.blocks.find(
          (candidate) =>
            candidate !== block &&
            candidate.isPlayer &&
            candidate.playerOrder === block.startPlayerOrder,
        );
        if (!currentPlayer) {
          throw new Error(
            `Cannot restart: player order ${block.startPlayerOrder} has no current block`,
          );
        }
        turn.playerSwitches.push({
          from: currentPlayer,
          to: block,
          order: block.startPlayerOrder,
          orderBackup: currentPlayer.playerOrder,
          dx: 0,
          dy: 0,
        });
      }

      const movableAtRestart =
        block.subLevel !== null ||
        block.possessable ||
        block.isPlayer ||
        block.startIsPlayer;
      if (
        block.outerLevel &&
        block.startOuterLevel &&
        movableAtRestart &&
        block.movedSinceRestart
      ) {
        turn.moves.push({
          block,
          fromLevel: block.outerLevel,
          fromX: block.x,
          fromY: block.y,
          fromFlipH: block.flipH,
          toLevel: block.startOuterLevel,
          toX: block.startX,
          toY: block.startY,
          toFlipH: block.startFlipH,
          dx: 0,
          dy: 0,
          nudge: false,
          movedSinceRestart: block.movedSinceRestart,
        });
      }
    }

    this.future.length = 0;
    this.past.push(turn);
    this.applyTurn(turn, true);
    this.currentTurn = createTurn(this.world.cameraFlipH);
    this.world.moveCount = 0;
    return true;
  }

  relocateWithoutHistory(
    block: Block,
    level: Level,
    x: number,
    y: number,
  ): void {
    const occupant = level.getBlock(x, y);
    if (occupant && occupant !== block) {
      throw new Error(
        `Cannot relocate block ${block.id} onto occupied (${x}, ${y}) in level ${level.id}`,
      );
    }
    this.moveBlock(block, level, x, y);
    this.world.computeBlockLists();
    this.world.updateButtonsPressed();
  }

  commitRelocation(
    block: Block,
    fromLevel: Level,
    fromX: number,
    fromY: number,
  ): Turn | null {
    const toLevel = assertOuterLevel(block);
    if (
      fromLevel === toLevel &&
      fromX === block.x &&
      fromY === block.y
    ) {
      return null;
    }

    this.beginTurn();
    this.registerMove({
      block,
      fromLevel,
      fromX,
      fromY,
      fromFlipH: block.flipH,
      toLevel,
      toX: block.x,
      toY: block.y,
      toFlipH: block.flipH,
      dx: 0,
      dy: 0,
      nudge: true,
      movedSinceRestart: block.movedSinceRestart,
    });
    return this.commit(this.world.moveCount + 1);
  }

  private applyTurn(turn: Turn, forward: boolean): void {
    for (const move of turn.moves) {
      if (forward) {
        this.moveBlock(move.block, move.toLevel, move.toX, move.toY);
        move.block.flipH = move.toFlipH;
        move.block.movedSinceRestart = !turn.isRestart;
      } else {
        this.moveBlock(move.block, move.fromLevel, move.fromX, move.fromY);
        move.block.flipH = move.fromFlipH;
        move.block.movedSinceRestart = turn.isRestart
          ? true
          : move.movedSinceRestart;
      }
      move.block.tempFlipH = move.block.flipH;
    }

    for (const playerSwitch of turn.playerSwitches) {
      if (forward) {
        if (
          playerSwitch.from.isPlayer &&
          playerSwitch.from.playerOrder === playerSwitch.order
        ) {
          playerSwitch.from.isPlayer = false;
          playerSwitch.from.playerOrder = playerSwitch.orderBackup;
        }
        playerSwitch.to.isPlayer = true;
        playerSwitch.to.playerOrder = playerSwitch.order;
      } else {
        if (
          playerSwitch.to.isPlayer &&
          playerSwitch.to.playerOrder === playerSwitch.order
        ) {
          playerSwitch.to.isPlayer = false;
          playerSwitch.to.playerOrder = playerSwitch.orderBackup;
        }
        playerSwitch.from.isPlayer = true;
        playerSwitch.from.playerOrder = playerSwitch.order;
      }
    }

    if (turn.wentToInfZoneChanged) {
      this.world.wentToInfZone = !this.world.wentToInfZone;
    }
    this.world.cameraFlipH = forward
      ? turn.toCameraFlipH
      : turn.fromCameraFlipH;
    this.world.computeBlockLists();
    this.world.updateButtonsPressed();
  }

  private moveBlock(block: Block, level: Level, x: number, y: number): void {
    const oldLevel = block.outerLevel;
    if (oldLevel?.getBlock(block.x, block.y) === block) {
      oldLevel.setBlock(block.x, block.y, null);
    }
    block.outerLevel = level;
    block.x = x;
    block.y = y;
    level.setBlock(x, y, block);
  }
}

export class MovementEngine {
  readonly world: WorldModel;
  readonly history: History;
  private moves: AttemptMove[] = [];
  private interloper: Block | null = null;
  private nudge = false;
  private possess = false;
  private infExitUnwinding = false;
  private infExitUnwindTo = -1;
  private infEnterUnwinding = false;
  private infEnterUnwindTo = -1;
  private cancelAllMovement = false;
  private portalTransition: PortalTransition | null = null;

  constructor(world: WorldModel) {
    this.world = world;
    this.history = new History(world);
  }

  impulse(block: Block, dx: number, dy: number): ImpulseResult {
    return this.impulseBlock(block, dx, dy, this.world.moveCount + 1);
  }

  applyDirectionalInput(dx: number, dy: number): ImpulseResult {
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      throw new Error(`Impulse must be cardinal, received (${dx}, ${dy})`);
    }
    if (this.world.winning) {
      return {
        moved: false,
        won: true,
        possessed: false,
        turn: null,
        transition: null,
      };
    }
    const moveCount = this.world.moveCount + 1;
    let moved = false;
    let possessed = false;
    let turn: Turn | null = null;
    let transition: PortalTransition | null = null;
    let playerBlockIndex = 0;

    while (playerBlockIndex < this.world.playerBlocks.length) {
      const playerBlock = this.world.playerBlocks[playerBlockIndex];
      if (!playerBlock) break;
      const result = this.impulseBlock(playerBlock, dx, dy, moveCount);
      moved ||= result.moved;
      possessed ||= result.possessed;
      if (result.turn) turn = result.turn;
      if (result.transition) {
        transition = result.transition;
        break;
      }
      playerBlockIndex++;
    }

    return {
      moved,
      won: this.world.winning,
      possessed,
      turn,
      transition,
    };
  }

  private impulseBlock(
    block: Block,
    dx: number,
    dy: number,
    moveCount: number,
  ): ImpulseResult {
    if (Math.abs(dx) + Math.abs(dy) !== 1) {
      throw new Error(`Impulse must be cardinal, received (${dx}, ${dy})`);
    }
    if (!block.isPlayer) {
      return {
        moved: false,
        won: this.world.winning,
        possessed: false,
        turn: null,
        transition: null,
      };
    }

    this.history.beginTurn();
    this.resetAttemptState();
    for (const candidate of this.world.blocks) {
      candidate.justEnteredArray = null;
      candidate.justInfEntered = false;
    }

    const moved = this.attemptToSlide(block, dx, dy);
    if (moved && this.portalTransition) {
      const transition = this.portalTransition;
      for (const candidate of this.world.blocks) {
        candidate.tempFlipH = candidate.flipH;
        candidate.tempInnerPush = false;
      }
      this.history.discardTurn();
      return {
        moved: true,
        won: this.world.winning,
        possessed: false,
        turn: null,
        transition,
      };
    }
    if (!moved || this.cancelAllMovement) {
      for (const candidate of this.world.blocks) {
        candidate.tempFlipH = candidate.flipH;
        candidate.tempInnerPush = false;
      }
      this.history.discardTurn();
      return {
        moved: false,
        won: this.world.winning,
        possessed: false,
        turn: null,
        transition: null,
      };
    }

    const possessed = this.possess;
    const turn = this.history.commit(moveCount);
    return {
      moved: true,
      won: this.world.winning,
      possessed,
      turn,
      transition: null,
    };
  }

  undo(): boolean {
    return this.history.undo();
  }

  redo(): boolean {
    return this.history.redo();
  }

  restart(): boolean {
    return this.history.restart();
  }

  relocateWithoutHistory(
    block: Block,
    level: Level,
    x: number,
    y: number,
  ): void {
    this.history.relocateWithoutHistory(block, level, x, y);
  }

  commitRelocation(
    block: Block,
    fromLevel: Level,
    fromX: number,
    fromY: number,
  ): Turn | null {
    return this.history.commitRelocation(
      block,
      fromLevel,
      fromX,
      fromY,
    );
  }

  private resetAttemptState(): void {
    this.moves = [];
    this.interloper = null;
    this.nudge = false;
    this.possess = false;
    this.infExitUnwinding = false;
    this.infExitUnwindTo = -1;
    this.infEnterUnwinding = false;
    this.infEnterUnwindTo = -1;
    this.cancelAllMovement = false;
    this.portalTransition = null;
    for (const block of this.world.blocks) {
      block.tempFlipH = block.flipH;
      block.tempInnerPush = false;
    }
  }

  private pushMove(move: Omit<AttemptMove, "shed" | "infExitNum" | "infEnterNum" | "infEaten" | "infEnterSourceBlock"> & Partial<Pick<AttemptMove, "shed" | "infExitNum" | "infEnterNum" | "infEaten" | "infEnterSourceBlock">>): void {
    this.moves.push({
      ...move,
      shed: move.shed ?? false,
      infExitNum: move.infExitNum ?? -1,
      infEnterNum: move.infEnterNum ?? -1,
      infEaten: move.infEaten ?? false,
      infEnterSourceBlock: move.infEnterSourceBlock ?? null,
    });
  }

  private popMove(): void {
    this.moves.pop();
  }

  private attemptToSlide(block: Block, dx: number, dy: number): boolean {
    if (this.cancelAllMovement) return false;
    const level = assertOuterLevel(block);
    const targetX = block.x + dx;
    const targetY = block.y + dy;
    this.pushMove({
      block,
      moveType: MoveType.Slide,
      fromLevel: level,
      fromLevelBlock: level.getExitBlock(),
      fromX: block.x,
      fromY: block.y,
      toLevel: level,
      toLevelBlock: level.getExitBlock(),
      toX: targetX,
      toY: targetY,
      dx,
      dy,
    });
    return this.attemptToMoveToSpot(
      block,
      level,
      targetX,
      targetY,
      dx,
      dy,
      MoveType.Slide,
    );
  }

  private attemptToMoveToSpot(
    block: Block,
    targetLevel: Level,
    targetX: number,
    targetY: number,
    dx: number,
    dy: number,
    moveType: MoveType,
  ): boolean {
    if (this.moves.length > 200) {
      this.cancelAllMovement = true;
      return false;
    }
    if (this.cancelAllMovement) return false;

    const move = this.moves.at(-1);
    if (!move) return false;

    if (move.moveType === MoveType.Exit) {
      for (let i = 0; i < this.moves.length - 1; i++) {
        const prior = this.moves[i];
        if (
          prior &&
          prior.block === move.block &&
          prior.moveType === MoveType.Exit &&
          prior.fromLevel === move.fromLevel &&
          prior.dx === move.dx
        ) {
          this.infExitUnwinding = true;
          this.infExitUnwindTo = i - 1;
          this.popMove();
          return false;
        }
      }
    }

    if (move.moveType === MoveType.Enter) {
      for (let i = 0; i < this.moves.length - 1; i++) {
        const prior = this.moves[i];
        if (
          prior &&
          prior.block === move.block &&
          prior.moveType === MoveType.Enter &&
          prior.toLevel === move.toLevel &&
          prior.toX === move.toX &&
          prior.toY === move.toY
        ) {
          this.infEnterUnwinding = true;
          this.infEnterUnwindTo = i - 1;
          this.popMove();
          return false;
        }
      }
    }

    for (let i = 0; i < this.moves.length - 1; i++) {
      const prior = this.moves[i];
      if (
        prior &&
        move.block === prior.block &&
        move.moveType === MoveType.Slide &&
        prior.moveType === MoveType.Slide &&
        move.dx !== prior.dx
      ) {
        this.popMove();
        return false;
      }
    }

    for (let i = 0; i < this.moves.length - 1; i++) {
      const prior = this.moves[i];
      if (prior && sameAttemptMove(move, prior)) {
        this.cancelAllMovement = true;
        this.popMove();
        return false;
      }
    }

    if (!block.subLevel && block.isPlayer) {
      for (let i = 0; i < this.moves.length - 1; i++) {
        if (this.moves[i]?.block !== block) {
          this.popMove();
          return false;
        }
      }
    }

    if (!block.subLevel && !block.isPlayer) {
      if (!this.world.innerPushEnabled) {
        this.popMove();
        return false;
      }
      const outer = assertOuterLevel(block);
      const exitBlock = outer.getExitBlock();
      if (!exitBlock.outerLevel) {
        this.popMove();
        return false;
      }
      for (let i = this.moves.length - 1; i >= 0; i--) {
        const prior = this.moves[i];
        if (prior?.block !== block) {
          if (prior?.moveType !== MoveType.Enter) break;
          this.popMove();
          return false;
        }
      }
      for (let i = 0; i < this.moves.length - 1; i++) {
        if (this.moves[i]?.block === exitBlock) {
          this.popMove();
          return false;
        }
      }
      block.tempInnerPush = true;
      const transformedDx = exitBlock.flipH ? -dx : dx;
      if (this.attemptToSlide(exitBlock, transformedDx, dy)) {
        this.nudge = true;
        return true;
      }
      block.tempInnerPush = false;
      this.popMove();
      return false;
    }

    if (!targetLevel.inBounds(targetX, targetY)) {
      let infExitNum = -1;
      for (let attempts = 0; attempts < 20; attempts++) {
        if (
          this.attemptToExit(
            block,
            targetLevel,
            infExitNum,
            dx,
            dy,
            targetX,
            targetY,
          )
        ) {
          return true;
        }
        if (!this.infExitUnwinding) {
          this.popMove();
          return false;
        }
        if (this.moves.length - 1 !== this.infExitUnwindTo) {
          this.popMove();
          return false;
        }
        this.infExitUnwinding = false;
        this.infExitUnwindTo = -1;
        infExitNum++;
      }
      this.cancelAllMovement = true;
      this.popMove();
      return false;
    }

    const blockAtTarget = targetLevel.getBlock(targetX, targetY);
    if (!blockAtTarget) {
      const floor = targetLevel.getFloor(targetX, targetY);
      if (
        floor?.type === FloorType.LevelPortal &&
        (!block.isPlayer || !floor.unlocked)
      ) {
        this.popMove();
        return false;
      }
      this.resolveMove(block, targetLevel, targetX, targetY, dx, dy);
      return true;
    }

    const previousForTarget = this.moves.find((candidate) => candidate.block === blockAtTarget);
    const targetAlreadyMoving = previousForTarget !== undefined;
    let blockAtTargetWithinInnerPushChain = false;
    if (targetAlreadyMoving) {
      for (let i = this.moves.length - 1; i >= 0; i--) {
        const candidate = this.moves[i]?.block;
        if (candidate?.tempInnerPush) {
          blockAtTargetWithinInnerPushChain = true;
          break;
        }
        if (candidate === blockAtTarget) break;
      }
    }

    if (
      previousForTarget &&
      ((previousForTarget.dx === dx && dx !== 0) ||
        (previousForTarget.dy === dy && dy !== 0)) &&
      !blockAtTargetWithinInnerPushChain
    ) {
      if (blockAtTarget.tempInnerPush) {
        this.popMove();
        return false;
      }
      let foundTarget = false;
      for (let i = this.moves.length - 1; i >= 0; i--) {
        const candidate = this.moves[i]?.block;
        if (candidate === blockAtTarget) foundTarget = true;
        if (foundTarget && candidate && candidate !== blockAtTarget) {
          this.interloper = candidate;
          break;
        }
      }
      this.resolveMove(block, targetLevel, targetX, targetY, dx, dy);
      return true;
    }

    if (
      previousForTarget &&
      ((previousForTarget.dx === -dx && dx !== 0) ||
        (previousForTarget.dy === -dy && dy !== 0))
    ) {
      this.popMove();
      return false;
    }

    const tryPush = (): boolean => {
      if (blockAtTargetWithinInnerPushChain || this.infEnterUnwinding) return false;
      if (this.attemptToSlide(blockAtTarget, dx, dy)) {
        this.resolveMove(block, targetLevel, targetX, targetY, dx, dy);
        return true;
      }
      return false;
    };

    const handleInfEnterUnwind = (): boolean => {
      if (!this.infEnterUnwinding) return false;
      if (this.moves.length - 1 !== this.infEnterUnwindTo) return false;
      this.infEnterUnwinding = false;
      this.infEnterUnwindTo = -1;
      return true;
    };

    const tryEnter = (): boolean => {
      if (!blockAtTarget.subLevel) return false;
      if (
        this.attemptToEnter(block, blockAtTarget, -1, false, null, dx, dy)
      ) {
        if (!block.justEnteredArray) this.setJustEnteredArray(block);
        return true;
      }

      for (let infEnterNum = 0; infEnterNum < 10; infEnterNum++) {
        if (!handleInfEnterUnwind()) return false;
        let infEnterBlock = blockAtTarget.subLevel.getInfEnterBlock(infEnterNum);
        if (!infEnterBlock) {
          this.world.createInfEnterZone(blockAtTarget.subLevel, infEnterNum);
          infEnterBlock = blockAtTarget.subLevel.getInfEnterBlock(infEnterNum);
          if (!infEnterBlock) return false;
        }
        if (
          this.attemptToEnter(
            block,
            infEnterBlock,
            infEnterNum,
            false,
            blockAtTarget,
            dx,
            dy,
          )
        ) {
          if (!block.justEnteredArray) {
            this.setJustEnteredArray(block);
            const entered = block.justEnteredArray as Block[] | null;
            if (entered) entered[0] = blockAtTarget;
          }
          block.justInfEntered = true;
          return true;
        }
      }
      this.cancelAllMovement = true;
      this.popMove();
      return false;
    };

    const tryEat = (): boolean => {
      if (
        this.infEnterUnwinding ||
        !blockAtTarget.subLevel ||
        !block.subLevel
      ) {
        return false;
      }
      if (
        this.attemptToEnter(blockAtTarget, block, -1, false, null, -dx, -dy)
      ) {
        if (!blockAtTarget.justEnteredArray) this.setJustEnteredArray(blockAtTarget);
        this.resolveMove(block, targetLevel, targetX, targetY, dx, dy);
        return true;
      }

      for (let infEnterNum = 0; infEnterNum < 10; infEnterNum++) {
        if (!handleInfEnterUnwind()) return false;
        let infEnterBlock = block.subLevel.getInfEnterBlock(infEnterNum);
        if (!infEnterBlock) {
          this.world.createInfEnterZone(block.subLevel, infEnterNum);
          infEnterBlock = block.subLevel.getInfEnterBlock(infEnterNum);
          if (!infEnterBlock) return false;
        }
        if (
          this.attemptToEnter(
            blockAtTarget,
            infEnterBlock,
            infEnterNum,
            true,
            block,
            -dx,
            -dy,
          )
        ) {
          if (!blockAtTarget.justEnteredArray) {
            this.setJustEnteredArray(blockAtTarget);
            const entered = blockAtTarget.justEnteredArray as Block[] | null;
            if (entered) entered[0] = block;
          }
          blockAtTarget.justInfEntered = true;
          this.resolveMove(block, targetLevel, targetX, targetY, dx, dy);
          return true;
        }
      }
      this.cancelAllMovement = true;
      this.popMove();
      return false;
    };

    const tryPossess = (): boolean => {
      if (
        this.infEnterUnwinding ||
        this.world.levelIsInfZone(blockAtTarget.outerLevel) ||
        !block.isPlayer ||
        !blockAtTarget.possessable ||
        blockAtTarget.isPlayer
      ) {
        return false;
      }
      for (let i = 0; i < this.moves.length - 1; i++) {
        if (this.moves[i]?.block !== block) return false;
      }
      this.nudge = true;
      this.possess = true;
      this.history.registerPlayerSwitch(block, blockAtTarget, dx, dy);
      if (!block.justEnteredArray) this.setJustEnteredArray(block);
      return true;
    };

    for (const attempt of this.world.attemptOrder) {
      if (attempt === Attempt.Push && tryPush()) return true;
      if (attempt === Attempt.Enter && tryEnter()) return true;
      if (attempt === Attempt.Eat && tryEat()) return true;
      if (attempt === Attempt.Possess && tryPossess()) return true;
    }

    this.popMove();
    void moveType;
    return false;
  }

  private computeEnterTargetPos(
    block: Block,
    toEnter: Block,
    dx: number,
    dy: number,
  ): { x: number; y: number } {
    let fraction = 0.5;
    let firstExit = true;

    for (const move of this.moves) {
      if (move.block !== block) continue;
      if (move.moveType === MoveType.Exit) {
        if (!move.fromLevel || !move.fromLevelBlock) {
          throw new Error("Exit attempt is missing its source level");
        }
        if (firstExit) {
          if (move.dx !== 0) {
            fraction = (move.fromY + 0.5) / move.fromLevel.height;
          } else if (move.dy !== 0) {
            fraction = (move.fromX + 0.5) / move.fromLevel.width;
          }
          firstExit = false;
        } else if (move.dx !== 0) {
          fraction = lerp(
            move.fromY / move.fromLevel.height,
            (move.fromY + 1) / move.fromLevel.height,
            fraction,
          );
        } else if (move.dy !== 0) {
          fraction = lerp(
            move.fromX / move.fromLevel.width,
            (move.fromX + 1) / move.fromLevel.width,
            fraction,
          );
        }
        if (move.dy !== 0 && move.fromLevelBlock.flipH) {
          fraction = 1 - fraction;
        }
      } else if (move.moveType === MoveType.Enter) {
        if (move.dy !== 0 && move.toLevelBlock.tempFlipH) {
          fraction = 1 - fraction;
        }
        if (move.dx !== 0) {
          fraction = inverseLerp(
            move.toY / move.toLevel.height,
            (move.toY + 1) / move.toLevel.height,
            fraction,
          );
        } else if (move.dy !== 0) {
          fraction = inverseLerp(
            move.toX / move.toLevel.width,
            (move.toX + 1) / move.toLevel.width,
            fraction,
          );
        }
      }
    }

    if (dy !== 0 && toEnter.tempFlipH) fraction = 1 - fraction;
    const subLevel = toEnter.subLevel;
    if (!subLevel) throw new Error(`Cannot enter block ${toEnter.id} without a sublevel`);

    if (dx !== 0) {
      return {
        x: dx < 0 ? subLevel.width - 1 : 0,
        y: Math.floor(fraction * subLevel.height),
      };
    }
    return {
      x: Math.floor(fraction * subLevel.width),
      y: dy < 0 ? subLevel.height - 1 : 0,
    };
  }

  private attemptToEnter(
    block: Block,
    toEnter: Block,
    infEnterNum: number,
    infEaten: boolean,
    infEnterSourceBlock: Block | null,
    inputDx: number,
    dy: number,
  ): boolean {
    if (
      this.cancelAllMovement ||
      (this.world.levelIsInfZone(toEnter.outerLevel) && infEnterNum === -1) ||
      toEnter.isSomeInfExitBlock
    ) {
      return false;
    }

    let dx = inputDx;
    let flipped = false;
    if (toEnter.tempFlipH) {
      dx *= -1;
      block.tempFlipH = !block.tempFlipH;
      flipped = true;
    }
    const target = this.computeEnterTargetPos(block, toEnter, dx, dy);

    let fromLevel: Level | null = null;
    let fromLevelBlock: Block | null = null;
    if (infEnterNum !== -1) {
      const lastMoveForBlock = [...this.moves]
        .reverse()
        .find((candidate) => candidate.block === block);
      if (lastMoveForBlock) {
        fromLevel = lastMoveForBlock.toLevel;
        fromLevelBlock = fromLevel.getExitBlock();
      }
    } else {
      fromLevel = assertOuterLevel(toEnter);
      fromLevelBlock = fromLevel.getExitBlock();
    }

    const toLevel = toEnter.subLevel;
    if (!toLevel) return false;
    this.pushMove({
      block,
      moveType: MoveType.Enter,
      fromLevel,
      fromLevelBlock,
      fromX: toEnter.x - dx,
      fromY: toEnter.y - dy,
      toLevel,
      toLevelBlock: toEnter,
      toX: target.x,
      toY: target.y,
      dx,
      dy,
      infEnterNum,
      infEaten,
      infEnterSourceBlock,
    });

    const moved = this.attemptToMoveToSpot(
      block,
      toLevel,
      target.x,
      target.y,
      dx,
      dy,
      MoveType.Enter,
    );
    if (!moved && flipped) block.tempFlipH = !block.tempFlipH;
    return moved;
  }

  private attemptToExit(
    block: Block,
    toExit: Level,
    infExitNum: number,
    inputDx: number,
    dy: number,
    oobX: number,
    oobY: number,
  ): boolean {
    if (this.cancelAllMovement) return false;

    let exitBlock =
      infExitNum === -1
        ? toExit.getExitBlock()
        : toExit.getInfExitBlock(infExitNum);
    if (infExitNum !== -1 && !exitBlock) {
      this.world.createInfExitZone(toExit, infExitNum);
      exitBlock = toExit.getInfExitBlock(infExitNum);
    }
    if (!exitBlock?.outerLevel) return false;

    let dx = inputDx;
    let flipped = false;
    if (exitBlock.flipH) {
      dx *= -1;
      block.tempFlipH = !block.tempFlipH;
      flipped = true;
    }
    const outerLevel = exitBlock.outerLevel;
    const targetX = exitBlock.x + dx;
    const targetY = exitBlock.y + dy;
    const move: AttemptMove = {
      block,
      moveType: MoveType.Exit,
      fromLevel: toExit,
      fromLevelBlock: exitBlock,
      fromX: oobX - dx,
      fromY: oobY - dy,
      toLevel: outerLevel,
      toLevelBlock: outerLevel.getExitBlock(),
      toX: targetX,
      toY: targetY,
      dx,
      dy,
      infExitNum,
      shed: false,
      infEnterNum: -1,
      infEaten: false,
      infEnterSourceBlock: null,
    };
    this.moves.push(move);

    let moved = this.attemptToMoveToSpot(
      block,
      outerLevel,
      targetX,
      targetY,
      dx,
      dy,
      MoveType.Exit,
    );
    if (this.world.shedEnabled && !moved && !this.infExitUnwinding) {
      move.shed = true;
      this.moves.push(move);
      const shedLevel = exitBlock.outerLevel;
      const shedX = exitBlock.x;
      const shedY = exitBlock.y;
      moved = this.attemptToSlide(exitBlock, -dx, -dy);
      if (moved) {
        this.resolveMove(block, shedLevel, shedX, shedY, dx, dy);
      } else {
        this.popMove();
      }
    }
    if (!moved && flipped) block.tempFlipH = !block.tempFlipH;
    return moved;
  }

  private setJustEnteredArray(block: Block): void {
    const entered: Block[] = [];
    for (let i = this.moves.length - 1; i >= 0; i--) {
      const move = this.moves[i];
      if (move?.block === block && move.moveType === MoveType.Enter) {
        entered.push(move.toLevelBlock);
      }
    }
    block.justEnteredArray = entered.length > 0 ? entered : null;
  }

  private resolveMove(
    block: Block,
    toLevel: Level,
    toX: number,
    toY: number,
    dx: number,
    dy: number,
  ): void {
    const floor = toLevel.getFloor(toX, toY);
    if (
      block.isPlayer &&
      floor?.type === FloorType.LevelPortal &&
      floor.unlocked
    ) {
      this.portalTransition = {
        floor,
        block,
        fromX: block.x,
        fromY: block.y,
        toX,
        toY,
        dx,
        dy,
      };
      return;
    }

    if (block === this.interloper) this.nudge = true;
    if (this.nudge) {
      if (this.history.currentTurn.moves.some((move) => move.block === block)) return;
      block.justEnteredArray = null;
      const first = this.moves.find((candidate) => candidate.block === block);
      const level = assertOuterLevel(block);
      this.history.registerMove({
        block,
        fromLevel: level,
        fromX: block.x,
        fromY: block.y,
        fromFlipH: block.flipH,
        toLevel: level,
        toX: block.x,
        toY: block.y,
        toFlipH: block.flipH,
        dx: first?.dx ?? 0,
        dy: first?.dy ?? 0,
        nudge: true,
        movedSinceRestart: block.movedSinceRestart,
      });
      return;
    }

    const fromLevel = assertOuterLevel(block);
    this.history.registerMove({
      block,
      fromLevel,
      fromX: block.x,
      fromY: block.y,
      fromFlipH: block.flipH,
      toLevel,
      toX,
      toY,
      toFlipH: block.tempFlipH,
      dx,
      dy,
      nudge: false,
      movedSinceRestart: block.movedSinceRestart,
    });

    if (
      block.isPlayer &&
      fromLevel !== toLevel &&
      block.tempFlipH !== block.flipH
    ) {
      this.history.registerCameraFlip();
    }

    if (!this.world.wentToInfZone && this.world.levelIsInfZone(toLevel)) {
      this.history.registerWentToInfZone();
    }
  }
}
