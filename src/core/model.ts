export enum Attempt {
  Push = "push",
  Enter = "enter",
  Eat = "eat",
  Possess = "possess",
}

export enum FloorType {
  Button = "Button",
  PlayerButton = "PlayerButton",
  LevelPortal = "Portal",
  Info = "Info",
  BreakFloor = "Break",
  FastTravel = "FastTravel",
  GalleryFloor = "Gallery",
  DemoEnd = "DemoEnd",
  Smile = "Smile",
  Show = "Show",
}

export enum DrawStyle {
  Normal = "normal",
  TuiColor = "tui",
  Grid = "grid",
  QuickAnim = "oldstyle",
}

export interface HsvColor {
  h: number;
  s: number;
  v: number;
}

export class Level {
  readonly id: number;
  width = 0;
  height = 0;
  blocks: Array<Array<Block | null>> = [];
  floors: Array<Array<Floor | null>> = [];
  readonly blocksWithThisAsTheirSubLevel: Block[] = [];
  readonly infExitBlocks: Array<Block | null> = [];
  readonly infEnterBlocks: Array<Block | null> = [];
  readonly blockList: Block[] = [];
  readonly floorList: Floor[] = [];
  infEffect = false;
  infZone = false;
  camZoomFactor = 1;
  infExitBlockSet = false;
  infEnterBlockSet = false;
  filledWithWalls = false;
  hubAreaName = "";
  indexDisplayName = "";
  tempFastTravelX = 0;
  tempFastTravelY = 0;
  hubShortcutWon = false;
  hubShowInTravel = false;

  constructor(id: number, width = 0, height = 0) {
    this.id = id;
    if (width > 0 && height > 0) {
      this.resizeAndClear(width, height);
    }
  }

  resizeAndClear(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.blocks = Array.from(
      { length: width },
      () => Array<Block | null>(height).fill(null),
    );
    this.floors = Array.from(
      { length: width },
      () => Array<Floor | null>(height).fill(null),
    );
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  getBlock(x: number, y: number): Block | null {
    if (!this.inBounds(x, y)) return null;
    return this.blocks[x]?.[y] ?? null;
  }

  setBlock(x: number, y: number, block: Block | null): void {
    const column = this.blocks[x];
    if (!column || y < 0 || y >= this.height) {
      throw new RangeError(`Block coordinate (${x}, ${y}) is outside level ${this.id}`);
    }
    column[y] = block;
  }

  getFloor(x: number, y: number): Floor | null {
    if (!this.inBounds(x, y)) return null;
    return this.floors[x]?.[y] ?? null;
  }

  setFloor(x: number, y: number, floor: Floor | null): void {
    const column = this.floors[x];
    if (!column || y < 0 || y >= this.height) {
      throw new RangeError(`Floor coordinate (${x}, ${y}) is outside level ${this.id}`);
    }
    column[y] = floor;
  }

  getExitBlock(): Block {
    const block = this.blocksWithThisAsTheirSubLevel[0];
    if (!block) {
      throw new Error(`Level ${this.id} has no exit block`);
    }
    return block;
  }

  setExitBlock(block: Block): void {
    const index = this.blocksWithThisAsTheirSubLevel.indexOf(block);
    if (index >= 0) this.blocksWithThisAsTheirSubLevel.splice(index, 1);
    this.blocksWithThisAsTheirSubLevel.unshift(block);
  }

  getInfExitBlock(index: number): Block | null {
    return this.infExitBlocks[index] ?? null;
  }

  getInfEnterBlock(index: number): Block | null {
    return this.infEnterBlocks[index] ?? null;
  }
}

export class Block {
  readonly id: number;
  outerLevel: Level | null = null;
  subLevel: Level | null = null;
  x = 0;
  y = 0;
  isPlayer = false;
  playerOrder = 0;
  flipH = false;
  tempFlipH = false;
  possessable = false;
  tempInnerPush = false;
  specialEffect = 0;
  color: HsvColor = { h: 0, s: 0, v: 0.8 };
  startX = 0;
  startY = 0;
  startOuterLevel: Level | null = null;
  startIsPlayer = false;
  startPlayerOrder = 0;
  startFlipH = false;
  movedSinceRestart = false;
  isSomeInfEnterBlock = false;
  someInfEnterNum = 0;
  isSomeInfExitBlock = false;
  generatedInf = false;
  rooted = false;
  locked = false;
  weight = false;
  shield = false;
  justEnteredArray: Block[] | null = null;
  justInfEntered = false;
  unlockerScene: string | null = null;

  constructor(id: number) {
    this.id = id;
  }

  init(x: number, y: number, outerLevel: Level | null, subLevel: Level | null): void {
    this.x = x;
    this.y = y;
    this.outerLevel = outerLevel;
    this.subLevel = subLevel;
    this.startX = x;
    this.startY = y;
    this.startOuterLevel = outerLevel;

    if (outerLevel) {
      if (!outerLevel.inBounds(x, y)) {
        throw new RangeError(
          `Block ${this.id} coordinate (${x}, ${y}) is outside level ${outerLevel.id}`,
        );
      }
      outerLevel.setBlock(x, y, this);
    }
    if (subLevel && !subLevel.blocksWithThisAsTheirSubLevel.includes(this)) {
      subLevel.blocksWithThisAsTheirSubLevel.push(this);
    }
  }
}

export class Floor {
  readonly id: number;
  readonly outerLevel: Level;
  readonly x: number;
  readonly y: number;
  readonly type: FloorType;
  sceneName = "";
  info = "";
  infoKey = "";
  unlocked = false;
  won = false;
  hard = 0;
  /** Mirrors the original Floor.AnimT used by Info and DemoEnd floors. */
  animationT = 0;
  readonly thumbnailAnimDeltaT = 1.75;

  constructor(
    id: number,
    x: number,
    y: number,
    outerLevel: Level,
    type: FloorType,
  ) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.outerLevel = outerLevel;
    this.type = type;
    outerLevel.setFloor(x, y, this);
  }
}

export class WorldModel {
  readonly levelName: string;
  readonly levels: Level[] = [];
  readonly blocks: Block[] = [];
  readonly floors: Floor[] = [];
  readonly fastTravelFloors: Floor[] = [];
  /**
   * Player blocks driven by the one human player's input, ordered exactly as
   * the original game orders `World.playerBlocks`. Ordinary boxes are never
   * added here; they move only when one of these player blocks pushes them.
   */
  readonly playerBlocks: Block[] = [];
  attemptOrder: Attempt[] = [
    Attempt.Push,
    Attempt.Enter,
    Attempt.Eat,
    Attempt.Possess,
  ];
  drawStyle = DrawStyle.Normal;
  shedEnabled = false;
  innerPushEnabled = false;
  showAttemptOrder = false;
  moveCount = 0;
  buttonsSatisfied = false;
  finishesSatisfied = false;
  winning = false;
  smile = false;
  cameraFlipH = false;
  wentToInfZone = false;
  rootBlock: Block | null = null;
  /**
   * Camera focus used when a level contains more than one player block.
   * The original loader starts with the first top-level block and lets
   * special effect 12 override it.
   */
  multiplePlayerFocusBlock: Block | null = null;
  specificFocusBlock: Block | null = null;
  private nextLevelId = 0;
  private nextBlockId = 0;
  private nextFloorId = 0;

  constructor(levelName: string) {
    this.levelName = levelName;
  }

  createLevel(width = 0, height = 0): Level {
    const level = new Level(this.nextLevelId++, width, height);
    this.levels.push(level);
    return level;
  }

  createBlock(
    x: number,
    y: number,
    outerLevel: Level | null,
    subLevel: Level | null,
  ): Block {
    const block = this.allocateBlock();
    return this.initializeBlock(block, x, y, outerLevel, subLevel);
  }

  allocateBlock(): Block {
    const block = new Block(this.nextBlockId++);
    this.blocks.push(block);
    return block;
  }

  initializeBlock(
    block: Block,
    x: number,
    y: number,
    outerLevel: Level | null,
    subLevel: Level | null,
  ): Block {
    block.init(x, y, outerLevel, subLevel);
    if (!this.rootBlock && outerLevel === null) this.rootBlock = block;
    return block;
  }

  createFloor(x: number, y: number, level: Level, type: FloorType): Floor {
    const floor = new Floor(this.nextFloorId++, x, y, level, type);
    this.floors.push(floor);
    if (type === FloorType.FastTravel) this.fastTravelFloors.push(floor);
    return floor;
  }

  removeFloor(floor: Floor): void {
    if (floor.outerLevel.getFloor(floor.x, floor.y) === floor) {
      floor.outerLevel.setFloor(floor.x, floor.y, null);
    }
    const levelIndex = floor.outerLevel.floorList.indexOf(floor);
    if (levelIndex >= 0) floor.outerLevel.floorList.splice(levelIndex, 1);
    const fastTravelIndex = this.fastTravelFloors.indexOf(floor);
    if (fastTravelIndex >= 0) {
      this.fastTravelFloors.splice(fastTravelIndex, 1);
    }
  }

  removeBlock(block: Block): void {
    const index = this.blocks.indexOf(block);
    if (index >= 0) this.blocks.splice(index, 1);
    const levelListIndex = block.outerLevel?.blockList.indexOf(block) ?? -1;
    if (levelListIndex >= 0) {
      block.outerLevel?.blockList.splice(levelListIndex, 1);
    }
    if (block.outerLevel?.getBlock(block.x, block.y) === block) {
      block.outerLevel.setBlock(block.x, block.y, null);
    }
    if (block.subLevel) {
      const exitIndex = block.subLevel.blocksWithThisAsTheirSubLevel.indexOf(block);
      if (exitIndex >= 0) {
        block.subLevel.blocksWithThisAsTheirSubLevel.splice(exitIndex, 1);
      }
    }
  }

  computeBlockLists(): void {
    this.playerBlocks.length = 0;
    for (const level of this.levels) {
      level.blockList.length = 0;
      level.floorList.length = 0;
      for (let x = 0; x < level.width; x++) {
        for (let y = 0; y < level.height; y++) {
          const block = level.getBlock(x, y);
          if (block) {
            level.blockList.push(block);
            if (block.isPlayer) this.playerBlocks.push(block);
          }
          const floor = level.getFloor(x, y);
          if (floor) level.floorList.push(floor);
        }
      }
    }
    this.playerBlocks.sort((a, b) => a.playerOrder - b.playerOrder);
  }

  findPlayerBlock(): Block {
    const player = this.playerBlocks[0];
    if (!player) throw new Error(`Level "${this.levelName}" has no player block`);
    return player;
  }

  getDefaultFocusBlock(): Block {
    if (this.levelName === "static_focus_block") {
      const focus = this.specificFocusBlock;
      if (!focus?.subLevel) {
        throw new Error(
          `Level "${this.levelName}" has no special-effect-1 focus block`,
        );
      }
      return focus;
    }

    if (this.playerBlocks.length > 1) {
      const focus = this.multiplePlayerFocusBlock;
      if (!focus?.subLevel) {
        throw new Error(
          `Level "${this.levelName}" has multiple player blocks but no focus block`,
        );
      }
      return focus;
    }

    const player = this.findPlayerBlock();
    if (this.drawStyle === DrawStyle.QuickAnim) {
      if (!player.subLevel) {
        throw new Error(
          `Old-style player block ${player.id} in "${this.levelName}" has no sublevel`,
        );
      }
      return player;
    }
    const level = player.outerLevel;
    if (!level) {
      throw new Error(
        `Player block ${player.id} in "${this.levelName}" has no outer level`,
      );
    }
    return level.getExitBlock();
  }

  inputFlipH(): boolean {
    if (this.drawStyle === DrawStyle.Normal) return this.cameraFlipH;
    if (this.drawStyle === DrawStyle.QuickAnim) {
      return this.findPlayerBlock().flipH;
    }
    return false;
  }

  updateButtonsPressed(): void {
    this.buttonsSatisfied = true;
    this.finishesSatisfied = true;
    let hasPlayerButton = false;

    for (const floor of this.floors) {
      const block = floor.outerLevel.getBlock(floor.x, floor.y);
      if (floor.type === FloorType.Button) {
        if (!block || block.isPlayer || !block.subLevel) {
          this.buttonsSatisfied = false;
        }
      } else if (floor.type === FloorType.PlayerButton) {
        hasPlayerButton = true;
        if (!block || !block.isPlayer || !block.subLevel) {
          this.finishesSatisfied = false;
        }
        if (
          this.levelName === "hub" &&
          floor.outerLevel.floorList.some(
            (candidate) =>
              candidate.type === FloorType.LevelPortal &&
              candidate.sceneName === "iii" &&
              !candidate.won,
          )
        ) {
          this.buttonsSatisfied = false;
        }
      }
    }

    if (!hasPlayerButton) this.finishesSatisfied = false;
    this.winning =
      this.levelName !== "hub" &&
      this.buttonsSatisfied &&
      this.finishesSatisfied;
  }

  /**
   * Advance the small presentation state attached to Info/DemoEnd floors.
   * The original updates this independently from undo history: a player on
   * the floor ramps the value up, while leaving it ramps the value down.
   */
  updateFloorAnimations(elapsedSeconds: number, paused = false): void {
    const dt = Math.max(0, elapsedSeconds);
    for (const floor of this.floors) {
      if (floor.type !== FloorType.Info && floor.type !== FloorType.DemoEnd) {
        continue;
      }
      if (paused) {
        floor.animationT = -0.4;
        continue;
      }
      const block = floor.outerLevel.getBlock(floor.x, floor.y);
      const delta = floor.thumbnailAnimDeltaT * dt;
      floor.animationT = block?.isPlayer
        ? Math.min(1, floor.animationT + delta)
        : Math.max(0, floor.animationT - delta);
    }
  }

  levelIsInfZone(level: Level | null): boolean {
    return level?.infZone ?? false;
  }

  parseAttemptOrder(raw: string): void {
    const parsed: Attempt[] = [];
    for (const entry of raw.split(",")) {
      if (entry.includes("push")) parsed.push(Attempt.Push);
      else if (entry.includes("enter")) parsed.push(Attempt.Enter);
      else if (entry.includes("eat")) parsed.push(Attempt.Eat);
      else if (entry.includes("possess")) parsed.push(Attempt.Possess);
      else {
        this.attemptOrder = [
          Attempt.Push,
          Attempt.Enter,
          Attempt.Eat,
          Attempt.Possess,
        ];
        return;
      }
    }
    this.attemptOrder = parsed;
  }

  createInfZone(): Block {
    const level = this.createLevel(7, 7);
    level.infEffect = true;
    level.infZone = true;
    const root = this.createBlock(0, 0, null, level);
    root.color = { h: 0, s: 0, v: 0.3 };
    return root;
  }

  createInfExitZone(level: Level, infExitNum: number): void {
    const infRoot = this.createInfZone();
    const infLevel = infRoot.subLevel;
    if (!infLevel) throw new Error("Generated infinite root has no sublevel");
    const block = this.createBlock(
      Math.floor(infLevel.width / 2),
      Math.floor(infLevel.height / 2),
      infLevel,
      level,
    );
    const exit = level.getExitBlock();
    block.color = { ...exit.color };
    while (level.infExitBlocks.length <= infExitNum) {
      level.infExitBlocks.push(null);
    }
    level.infExitBlocks[infExitNum] = block;
    block.isSomeInfExitBlock = true;
    block.generatedInf = true;
  }

  createInfEnterZone(level: Level, infEnterNum: number): void {
    const infRoot = this.createInfZone();
    const infLevel = infRoot.subLevel;
    if (!infLevel) throw new Error("Generated infinite root has no sublevel");
    const wrapperLevel = this.createLevel(5, 5);
    const block = this.createBlock(
      Math.floor(infLevel.width / 2),
      Math.floor(infLevel.height / 2),
      infLevel,
      wrapperLevel,
    );
    block.color = { ...level.getExitBlock().color };
    while (level.infEnterBlocks.length <= infEnterNum) {
      level.infEnterBlocks.push(null);
    }
    level.infEnterBlocks[infEnterNum] = block;
    block.isSomeInfEnterBlock = true;
    block.someInfEnterNum = infEnterNum;
    block.generatedInf = true;
  }

  fillLevelWithWalls(level: Level): void {
    for (const block of [...level.blockList]) this.removeBlock(block);
    level.resizeAndClear(1, 1);
    this.createBlock(0, 0, level, null);
    level.filledWithWalls = true;
  }

  maybeFillDonut(level: Level): void {
    if (level.filledWithWalls || level.infZone || level.floorList.length > 0) return;
    for (const block of level.blockList) {
      const onEdge =
        block.x === 0 ||
        block.y === 0 ||
        block.x === level.width - 1 ||
        block.y === level.height - 1;
      if (block.subLevel || !onEdge || block.possessable || block.isPlayer) return;
    }
    for (let x = 0; x < level.width; x++) {
      for (let y = 0; y < level.height; y++) {
        const onEdge =
          x === 0 || y === 0 || x === level.width - 1 || y === level.height - 1;
        if (onEdge && !level.getBlock(x, y)) return;
      }
    }
    this.fillLevelWithWalls(level);
  }
}
