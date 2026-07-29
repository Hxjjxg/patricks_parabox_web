import {
  Block,
  DrawStyle,
  FloorType,
  type HsvColor,
  Level,
  WorldModel,
} from "./model";
import { localizeEnglish } from "./localization";

interface DeferredReference {
  tokens: string[];
  parentBlock: Block;
  depth: number;
}

function parseBool(value: string | undefined): boolean {
  return value === "1" || value?.toLowerCase() === "true";
}

function numberAt(tokens: string[], index: number, context: string): number {
  const raw = tokens[index];
  const value = Number(raw);
  if (raw === undefined || !Number.isFinite(value)) {
    throw new Error(`${context}: expected a number at token ${index}, got "${raw}"`);
  }
  return value;
}

function tokenAt(tokens: string[], index: number, context: string): string {
  const value = tokens[index];
  if (value === undefined) {
    throw new Error(`${context}: missing token ${index}`);
  }
  return value;
}

function ensureSlot<T>(array: Array<T | null>, index: number): void {
  while (array.length <= index) array.push(null);
}

function copyColor(color: HsvColor): HsvColor {
  return { h: color.h, s: color.s, v: color.v };
}

export function parseLevel(source: string, levelName: string): WorldModel {
  const world = new WorldModel(levelName);
  const inHub = levelName === "hub";
  const levelIds = new Map<number, Level>();
  const blockStack: Block[] = [];
  const references: DeferredReference[] = [];
  let inHeader = true;

  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
    const raw = lines[lineNumber] ?? "";
    if (raw.trim().length === 0) continue;
    const context = `${levelName}:${lineNumber + 1}`;
    const depth = raw.match(/^\t*/)?.[0].length ?? 0;
    const tokens = raw.trimStart().trim().split(/\s+/);
    const command = tokens[0];

    if (inHeader) {
      if (command === "#") {
        inHeader = false;
      } else if (command === "version") {
        const version = tokenAt(tokens, 1, context);
        if (version !== "4") {
          throw new Error(`${context}: unsupported level version ${version}`);
        }
      } else if (command === "attempt_order") {
        world.parseAttemptOrder(tokenAt(tokens, 1, context));
        world.showAttemptOrder = true;
      } else if (command === "shed") {
        world.shedEnabled = parseBool(tokens[1]);
      } else if (command === "inner_push") {
        world.innerPushEnabled = parseBool(tokens[1]);
      } else if (command === "draw_style") {
        const style = tokens[1];
        if (style === "tui") world.drawStyle = DrawStyle.TuiColor;
        else if (style === "grid") world.drawStyle = DrawStyle.Grid;
        else if (style === "oldstyle") {
          world.drawStyle = DrawStyle.QuickAnim;
        }
      }
      continue;
    }

    while (blockStack.length > depth) blockStack.pop();

    switch (command) {
      case "Block": {
        const isTopLevelBlock = blockStack.length === 0;
        const x = numberAt(tokens, 1, context);
        const y = numberAt(tokens, 2, context);
        const levelId = numberAt(tokens, 3, context);
        const width = numberAt(tokens, 4, context);
        const height = numberAt(tokens, 5, context);
        const color = {
          h: numberAt(tokens, 6, context),
          s: numberAt(tokens, 7, context),
          v: numberAt(tokens, 8, context),
        };
        const camZoomFactor = numberAt(tokens, 9, context);
        const filledWithWalls = parseBool(tokens[10]);
        const isPlayer = parseBool(tokens[11]);
        const possessable = parseBool(tokens[12]);
        const playerOrder = numberAt(tokens, 13, context);
        const flipH = parseBool(tokens[14]);
        const detachedInInfZone = parseBool(tokens[15]);
        const specialEffect = numberAt(tokens, 16, context);

        const subLevel = world.createLevel(width, height);
        subLevel.camZoomFactor = camZoomFactor;
        let block: Block;
        if (blockStack.length === 0) {
          if (specialEffect === 9) {
            block = world.allocateBlock();
            const infRoot = world.createInfZone();
            const infLevel = infRoot.subLevel;
            if (!infLevel) throw new Error(`${context}: invalid generated inf zone`);
            world.initializeBlock(
              block,
              Math.floor(infLevel.width / 2),
              Math.floor(infLevel.height / 2),
              infLevel,
              subLevel,
            );
          } else {
            block = world.createBlock(x, y, null, subLevel);
          }
        } else if (specialEffect === 6) {
          block = world.createBlock(0, 0, null, subLevel);
          subLevel.hubAreaName = "Area_Intro";
          subLevel.indexDisplayName = "Area_Intro";
        } else if (detachedInInfZone) {
          if (specialEffect === 11) {
            block = world.createBlock(0, 0, null, subLevel);
          } else {
            block = world.allocateBlock();
            const infRoot = world.createInfZone();
            const infLevel = infRoot.subLevel;
            if (!infLevel) throw new Error(`${context}: invalid generated inf zone`);
            world.initializeBlock(
              block,
              Math.floor(infLevel.width / 2),
              Math.floor(infLevel.height / 2),
              infLevel,
              subLevel,
            );
          }
        } else {
          const parentLevel = blockStack.at(-1)?.subLevel;
          if (!parentLevel) throw new Error(`${context}: parent block has no sublevel`);
          block = world.createBlock(x, y, parentLevel, subLevel);
        }

        levelIds.set(levelId, subLevel);
        block.color = color;
        block.isPlayer = isPlayer;
        block.startIsPlayer = isPlayer;
        block.possessable = possessable;
        block.playerOrder = playerOrder;
        block.startPlayerOrder = playerOrder;
        block.flipH = flipH;
        block.startFlipH = flipH;
        block.tempFlipH = flipH;
        block.specialEffect = specialEffect;
        if (isTopLevelBlock && !world.multiplePlayerFocusBlock) {
          world.multiplePlayerFocusBlock = block;
        }
        if (specialEffect === 12) {
          world.multiplePlayerFocusBlock = block;
        }
        if (specialEffect === 1 && !world.specificFocusBlock) {
          world.specificFocusBlock = block;
        }
        if (inHub && depth === 1) {
          subLevel.tempFastTravelX = x;
          subLevel.tempFastTravelY = y;
        }
        if (filledWithWalls) world.fillLevelWithWalls(subLevel);
        blockStack.push(block);
        break;
      }

      case "Wall": {
        const parentLevel = blockStack.at(-1)?.subLevel;
        if (!parentLevel) throw new Error(`${context}: wall has no parent level`);
        const x = numberAt(tokens, 1, context);
        const y = numberAt(tokens, 2, context);
        const isPlayer = parseBool(tokens[3]);
        const possessable = parseBool(tokens[4]);
        const playerOrder = numberAt(tokens, 5, context);
        const block = world.createBlock(x, y, parentLevel, null);
        block.isPlayer = isPlayer;
        block.startIsPlayer = isPlayer;
        block.possessable = possessable;
        block.playerOrder = playerOrder;
        block.startPlayerOrder = playerOrder;
        if (inHub) {
          const unlockerScene = tokens[6];
          block.unlockerScene =
            unlockerScene && unlockerScene !== "_" ? unlockerScene : null;
        }
        break;
      }

      case "Floor": {
        const parentLevel = blockStack.at(-1)?.subLevel;
        if (!parentLevel) throw new Error(`${context}: floor has no parent level`);
        const x = numberAt(tokens, 1, context);
        const y = numberAt(tokens, 2, context);
        const rawType = tokenAt(tokens, 3, context);
        const type = Object.values(FloorType).find((value) => value === rawType);
        if (!type) break;
        const floor = world.createFloor(x, y, parentLevel, type);
        if (type === FloorType.LevelPortal) {
          floor.sceneName = tokenAt(tokens, 4, context);
        } else if (type === FloorType.Info) {
          floor.infoKey = tokens[4] ?? "";
          floor.info = inHub
            ? localizeEnglish(floor.infoKey)
            : floor.infoKey
                .replaceAll("_", " ")
                .replaceAll("\\n", "\n")
                .replaceAll("\\\\", "\\");
        }
        break;
      }

      case "Ref": {
        const parentBlock = blockStack.at(-1);
        if (!parentBlock) throw new Error(`${context}: reference has no parent block`);
        references.push({ tokens, parentBlock, depth });
        break;
      }

      default:
        break;
    }
  }

  for (const reference of references) {
    const { tokens, parentBlock } = reference;
    const context = `${levelName}:Ref`;
    const x = numberAt(tokens, 1, context);
    const y = numberAt(tokens, 2, context);
    const targetLevelId = numberAt(tokens, 3, context);
    const isExit = parseBool(tokens[4]);
    const isInfExit = parseBool(tokens[5]);
    const infExitNum = numberAt(tokens, 6, context);
    const isInfEnter = parseBool(tokens[7]);
    const infEnterNum = numberAt(tokens, 8, context);
    const infEnterTargetLevelId = numberAt(tokens, 9, context);
    const isPlayer = parseBool(tokens[10]);
    const possessable = parseBool(tokens[11]);
    const playerOrder = numberAt(tokens, 12, context);
    const flipH = parseBool(tokens[13]);
    const detachedInInfZone = parseBool(tokens[14]);
    const specialEffect = numberAt(tokens, 15, context);
    const targetLevel = levelIds.get(targetLevelId);
    if (!targetLevel) {
      throw new Error(`${context}: unknown target level id ${targetLevelId}`);
    }

    let block: Block;
    if (detachedInInfZone) {
      block = world.allocateBlock();
      const infRoot = world.createInfZone();
      const infLevel = infRoot.subLevel;
      if (!infLevel) throw new Error(`${context}: invalid generated inf zone`);
      world.initializeBlock(
        block,
        Math.floor(infLevel.width / 2),
        Math.floor(infLevel.height / 2),
        infLevel,
        targetLevel,
      );
    } else {
      const parentLevel = parentBlock.subLevel;
      if (!parentLevel) throw new Error(`${context}: parent block has no sublevel`);
      block = world.createBlock(x, y, parentLevel, targetLevel);
    }

    block.color = copyColor(targetLevel.getExitBlock().color);
    if (isExit) {
      const previousExit = targetLevel.getExitBlock();
      if (previousExit.outerLevel === null) {
        world.removeBlock(previousExit);
      }
      targetLevel.setExitBlock(block);
      if (world.multiplePlayerFocusBlock === previousExit) {
        world.multiplePlayerFocusBlock = block;
      }
    }
    if (isInfExit) {
      ensureSlot(targetLevel.infExitBlocks, infExitNum);
      targetLevel.infExitBlocks[infExitNum] = block;
      targetLevel.infExitBlockSet = true;
      block.isSomeInfExitBlock = true;
    }
    if (isInfEnter) {
      const infEnterTarget = levelIds.get(infEnterTargetLevelId);
      if (!infEnterTarget) {
        throw new Error(
          `${context}: unknown infinite-enter target level id ${infEnterTargetLevelId}`,
        );
      }
      targetLevel.infEffect = true;
      ensureSlot(infEnterTarget.infEnterBlocks, infEnterNum);
      infEnterTarget.infEnterBlocks[infEnterNum] = block;
      infEnterTarget.infEnterBlockSet = true;
      block.isSomeInfEnterBlock = true;
      block.someInfEnterNum = infEnterNum;
    }
    block.isPlayer = isPlayer;
    block.startIsPlayer = isPlayer;
    block.possessable = possessable;
    block.playerOrder = playerOrder;
    block.startPlayerOrder = playerOrder;
    block.flipH = flipH;
    block.startFlipH = flipH;
    block.tempFlipH = flipH;
    block.specialEffect = specialEffect;
    if (specialEffect === 12) {
      world.multiplePlayerFocusBlock = block;
    }
    if (specialEffect === 1 && !world.specificFocusBlock) {
      world.specificFocusBlock = block;
    }
    if (inHub) {
      const hubAreaName = tokens[16];
      if (hubAreaName && hubAreaName !== "_") {
        targetLevel.hubAreaName = hubAreaName;
        targetLevel.indexDisplayName = hubAreaName;
      }
    }
  }

  world.computeBlockLists();
  for (const level of [...world.levels]) world.maybeFillDonut(level);
  for (const level of [...world.levels]) {
    if (!level.infExitBlockSet && !level.filledWithWalls && !level.infZone) {
      world.createInfExitZone(level, 0);
    }
  }
  world.computeBlockLists();
  world.updateButtonsPressed();
  return world;
}
