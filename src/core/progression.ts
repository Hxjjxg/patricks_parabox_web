import puzzleDataSource from "../assets/data/puzzle_data.txt?raw";
import puzzleLinesSource from "../assets/data/puzzle_lines.txt?raw";
import { customLevelSceneName } from "./customLevels";
import { Floor, FloorType, Level, WorldModel } from "./model";

export interface PuzzleMetadata {
  readonly name: string;
  readonly music: number;
  readonly musicArea: number;
  readonly palette: number;
  readonly hard: number;
  readonly eyesJump: boolean;
  readonly referenceName: string;
}

export interface PuzzleLink {
  readonly from: string;
  readonly to: string;
  readonly immediate: boolean;
}

export interface ProgressSnapshot {
  readonly version: 3;
  readonly wonLevels: string[];
  readonly attemptedLevels: string[];
  readonly recentArea: string | null;
  readonly nexusUnlocked: boolean;
  readonly playtimeSeconds: number;
  /** Bonus flags are save-slot scoped in the original game. */
  readonly unlockAllPuzzles?: boolean;
  readonly randomize?: boolean;
  readonly randomizeMusic?: boolean;
}

function parsePuzzleMetadata(source: string): Map<string, PuzzleMetadata> {
  const metadata = new Map<string, PuzzleMetadata>();
  for (const rawLine of source.replaceAll("\r", "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [
      name,
      music,
      musicArea,
      palette,
      hard,
      eyesJump,
      referenceName,
    ] = line.split(/\s+/);
    if (
      !name ||
      music === undefined ||
      musicArea === undefined ||
      palette === undefined ||
      hard === undefined ||
      eyesJump === undefined ||
      referenceName === undefined
    ) {
      throw new Error(`Invalid puzzle metadata line: ${line}`);
    }
    metadata.set(name, {
      name,
      music: Number(music),
      musicArea: Number(musicArea),
      palette: Number(palette),
      hard: Number(hard),
      eyesJump: eyesJump === "1",
      referenceName,
    });
  }
  return metadata;
}

function parsePuzzleLinks(source: string): PuzzleLink[] {
  const links: PuzzleLink[] = [];
  for (const rawLine of source.replaceAll("\r", "").split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const [from, to, immediate] = line.split(/\s+/);
    if (!from || !to || immediate === undefined) {
      throw new Error(`Invalid puzzle link line: ${line}`);
    }
    links.push({ from, to, immediate: immediate === "1" });
  }
  return links;
}

export const puzzleMetadata = parsePuzzleMetadata(puzzleDataSource);
export const puzzleLinks = parsePuzzleLinks(puzzleLinesSource);

const incomingLinks = new Map<string, PuzzleLink[]>();
const outgoingLinks = new Map<string, PuzzleLink[]>();
for (const link of puzzleLinks) {
  const incoming = incomingLinks.get(link.to) ?? [];
  incoming.push(link);
  incomingLinks.set(link.to, incoming);
  const outgoing = outgoingLinks.get(link.from) ?? [];
  outgoing.push(link);
  outgoingLinks.set(link.from, outgoing);
}

function isSpaceEmpty(level: Level, x: number, y: number): boolean {
  return (
    level.inBounds(x, y) &&
    level.getFloor(x, y) === null &&
    level.getBlock(x, y) === null
  );
}

function findReturnOffset(
  floor: Floor,
  preferred: { dx: number; dy: number },
): { dx: number; dy: number } {
  if (
    isSpaceEmpty(
      floor.outerLevel,
      floor.x + preferred.dx,
      floor.y + preferred.dy,
    )
  ) {
    return preferred;
  }

  const directional = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  for (const candidate of directional) {
    const forwardEmpty = isSpaceEmpty(
      floor.outerLevel,
      floor.x + candidate.dx,
      floor.y + candidate.dy,
    );
    const oppositeEmpty = isSpaceEmpty(
      floor.outerLevel,
      floor.x - candidate.dx,
      floor.y - candidate.dy,
    );
    if (forwardEmpty && !oppositeEmpty) return candidate;
  }

  for (const candidate of [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ]) {
    if (
      isSpaceEmpty(
        floor.outerLevel,
        floor.x + candidate.dx,
        floor.y + candidate.dy,
      )
    ) {
      return candidate;
    }
  }
  return { dx: 0, dy: -1 };
}

export class ProgressionModel {
  readonly wonLevels: Set<string>;
  readonly attemptedLevels: Set<string>;
  recentPuzzle: string | null;
  returnOffset: { dx: number; dy: number };
  recentArea: string | null;
  private playtimeSecondsState: number;
  private nexusUnlockedState: boolean;
  private unlockAllPuzzlesState: boolean;
  private randomizeState: boolean;
  private randomizeMusicState: boolean;
  private hubReturnPosition: {
    areaName: string;
    x: number;
    y: number;
  } | null = null;

  constructor(snapshot?: Partial<ProgressSnapshot>) {
    this.wonLevels = new Set(snapshot?.wonLevels ?? []);
    this.attemptedLevels = new Set(snapshot?.attemptedLevels ?? []);
    this.recentPuzzle = null;
    this.returnOffset = {
      dx: 0,
      dy: -1,
    };
    this.recentArea = snapshot?.recentArea ?? null;
    this.playtimeSecondsState = Math.max(
      0,
      Number.isFinite(snapshot?.playtimeSeconds)
        ? snapshot?.playtimeSeconds ?? 0
        : 0,
    );
    this.nexusUnlockedState =
      snapshot?.nexusUnlocked ??
      (snapshot?.wonLevels?.includes("iii") ?? false);
    this.unlockAllPuzzlesState = snapshot?.unlockAllPuzzles ?? false;
    this.randomizeState = snapshot?.randomize ?? false;
    this.randomizeMusicState = snapshot?.randomizeMusic ?? false;
  }

  get nexusUnlocked(): boolean {
    return this.nexusUnlockedState;
  }

  get playtimeSeconds(): number {
    return this.playtimeSecondsState;
  }

  get unlockAllPuzzles(): boolean {
    return this.unlockAllPuzzlesState;
  }

  get randomize(): boolean {
    return this.randomizeState;
  }

  get randomizeMusic(): boolean {
    return this.randomizeMusicState;
  }

  get allWon(): boolean {
    for (const levelName of puzzleMetadata.keys()) {
      if (!this.wonLevels.has(levelName)) return false;
    }
    return true;
  }

  serialize(): ProgressSnapshot {
    return {
      version: 3,
      wonLevels: [...this.wonLevels].sort(),
      attemptedLevels: [...this.attemptedLevels].sort(),
      recentArea: this.recentArea,
      nexusUnlocked: this.nexusUnlocked,
      playtimeSeconds: this.playtimeSeconds,
      ...(this.unlockAllPuzzlesState ? { unlockAllPuzzles: true } : {}),
      ...(this.randomizeState ? { randomize: true } : {}),
      ...(this.randomizeMusicState ? { randomizeMusic: true } : {}),
    };
  }

  addPlaytime(seconds: number): void {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    this.playtimeSecondsState += seconds;
  }

  unlockNexus(): boolean {
    if (this.nexusUnlockedState) return false;
    this.nexusUnlockedState = true;
    return true;
  }

  toggleUnlockAllPuzzles(): boolean {
    this.unlockAllPuzzlesState = !this.unlockAllPuzzlesState;
    return this.unlockAllPuzzlesState;
  }

  setUnlockAllPuzzles(enabled: boolean): boolean {
    if (this.unlockAllPuzzlesState === enabled) return false;
    this.unlockAllPuzzlesState = enabled;
    return true;
  }

  toggleRandomize(): boolean {
    this.randomizeState = !this.randomizeState;
    return this.randomizeState;
  }

  setRandomize(enabled: boolean): boolean {
    if (this.randomizeState === enabled) return false;
    this.randomizeState = enabled;
    return true;
  }

  toggleRandomizeMusic(): boolean {
    this.randomizeMusicState = !this.randomizeMusicState;
    return this.randomizeMusicState;
  }

  setRandomizeMusic(enabled: boolean): boolean {
    if (this.randomizeMusicState === enabled) return false;
    this.randomizeMusicState = enabled;
    return true;
  }

  setRecentArea(areaName: string): boolean {
    if (!areaName || this.recentArea === areaName) return false;
    this.recentArea = areaName;
    return true;
  }

  clearRecentPuzzle(): void {
    this.recentPuzzle = null;
  }

  setHubReturnPosition(
    areaName: string,
    x: number,
    y: number,
  ): void {
    this.hubReturnPosition = { areaName, x, y };
    this.recentPuzzle = null;
    this.setRecentArea(areaName);
  }

  markAttempted(levelName: string): void {
    if (levelName === "hub" || levelName === customLevelSceneName) return;
    this.attemptedLevels.add(levelName);
    this.recentPuzzle = levelName;
  }

  markWon(levelName: string): boolean {
    if (levelName === customLevelSceneName) return false;
    const sizeBefore = this.wonLevels.size;
    this.wonLevels.add(levelName);
    return this.wonLevels.size !== sizeBefore;
  }

  nextLevelAfterWin(levelName: string, newlyWon: boolean): string {
    if (newlyWon) {
      const immediate = (outgoingLinks.get(levelName) ?? []).find(
        (link) => link.immediate && !this.wonLevels.has(link.to),
      );
      if (immediate) return immediate.to;
    }
    return "hub";
  }

  enterPortal(floor: Floor, fromX: number, fromY: number): void {
    this.recentPuzzle = floor.sceneName;
    this.setRecentArea(floor.outerLevel.hubAreaName);
    this.returnOffset = {
      dx: fromX - floor.x,
      dy: fromY - floor.y,
    };
  }

  applyToHub(world: WorldModel): void {
    if (world.levelName !== "hub") return;

    for (const floor of world.floors) {
      if (floor.type !== FloorType.LevelPortal) continue;
      const metadata = puzzleMetadata.get(floor.sceneName);
      floor.hard = metadata?.hard ?? 0;
      floor.won = this.wonLevels.has(floor.sceneName);
      floor.unlocked = false;
    }

    for (const level of world.levels) {
      level.hubShortcutWon = false;
      level.hubShowInTravel = false;
      const areaPortals = level.floorList.filter(
        (floor) => floor.type === FloorType.LevelPortal,
      );
      level.hubShortcutWon =
        areaPortals.length > 0 && areaPortals.every((floor) => floor.won);
    }

    const levelByArea = (areaName: string): Level | undefined =>
      world.levels.find((level) => level.hubAreaName === areaName);
    if (
      levelByArea("Area_Priority")?.hubShortcutWon &&
      levelByArea("Area_Extrude")?.hubShortcutWon &&
      levelByArea("Area_Push")?.hubShortcutWon
    ) {
      const appendix = levelByArea("Area_Appendix");
      if (appendix) appendix.hubShortcutWon = true;
    }
    if (this.allWon) {
      const index = levelByArea("Area_Index");
      const reception = levelByArea("Area_Reception");
      if (index) index.hubShortcutWon = true;
      if (reception) reception.hubShortcutWon = true;
    }

    for (const block of [...world.blocks]) {
      if (
        block.subLevel === null &&
        block.unlockerScene &&
        this.hubWallUnlocked(block.outerLevel, block.unlockerScene)
      ) {
        world.removeBlock(block);
      }
    }

    world.computeBlockLists();

    for (const floor of world.floors) {
      if (floor.type === FloorType.LevelPortal) {
        floor.unlocked = this.portalUnlocked(floor);
      } else if (
        (floor.type === FloorType.Smile || floor.type === FloorType.Show) &&
        !this.allWon
      ) {
        world.removeFloor(floor);
      } else if (
        floor.type === FloorType.Info &&
        ((floor.infoKey === "Sign_100Percent" && !this.allWon) ||
          (floor.infoKey === "Sign_Congratulations" &&
            !this.nexusUnlocked))
      ) {
        world.removeFloor(floor);
      }
    }

    this.configureFastTravel(world);
    world.computeBlockLists();
    if (this.positionPlayerAtHubReturn(world)) {
      // The explicit return point is consumed after one Hub load.
    } else if (this.recentPuzzle) {
      this.positionPlayerAtRecentPortal(world);
    } else {
      this.positionPlayerAtRecentArea(world);
    }
    world.computeBlockLists();
    world.updateButtonsPressed();
  }

  private positionPlayerAtHubReturn(world: WorldModel): boolean {
    const position = this.hubReturnPosition;
    this.hubReturnPosition = null;
    if (!position) return false;
    const level = world.levels.find(
      (candidate) => candidate.hubAreaName === position.areaName,
    );
    if (
      !level ||
      !level.inBounds(position.x, position.y) ||
      level.getBlock(position.x, position.y) !== null
    ) {
      return false;
    }

    this.moveHubPlayer(world, level, position.x, position.y);
    return true;
  }

  private hubWallUnlocked(
    level: Level | null,
    unlockerScene: string,
  ): boolean {
    if (!level) return false;
    if (unlockerScene === "*clear") return this.nexusUnlocked;
    if (unlockerScene === "*clear_or_unlock_all") {
      return this.nexusUnlocked || this.unlockAllPuzzlesState;
    }
    if (unlockerScene === "*all") return this.allWon;
    if (this.unlockAllPuzzlesState) return true;

    let requiredCoreWins = 0;
    let areaWins = 0;
    for (const floor of level.floorList) {
      if (floor.type !== FloorType.LevelPortal) continue;
      if ((puzzleMetadata.get(floor.sceneName)?.hard ?? 0) === 0) {
        requiredCoreWins++;
      }
      if (floor.won) areaWins++;
    }
    if (level.hubAreaName === "Area_Swap") requiredCoreWins--;
    if (level.hubAreaName === "Area_Wall") requiredCoreWins--;
    areaWins = Math.min(areaWins, requiredCoreWins);
    return areaWins >= requiredCoreWins;
  }

  private portalUnlocked(floor: Floor): boolean {
    if (this.unlockAllPuzzlesState) return true;
    if (floor.won) return true;
    const incoming = incomingLinks.get(floor.sceneName) ?? [];
    if (incoming[0] && this.wonLevels.has(incoming[0].from)) return true;

    const exitBlock = floor.outerLevel.getExitBlock();
    const parentLevel = exitBlock.outerLevel;
    const gatewayOpen =
      parentLevel !== null &&
      parentLevel.getBlock(exitBlock.x, exitBlock.y + 1) === null;
    if (!gatewayOpen && floor.outerLevel.hubAreaName !== "Area_Intro") {
      return false;
    }

    if (floor.hard === 1) {
      return (
        incoming.length === 0 ||
        this.wonLevels.has(incoming[0]?.from ?? "")
      );
    }

    if (floor.hard === 2) {
      if (incoming.length > 0) {
        return this.wonLevels.has(incoming[0]?.from ?? "");
      }
      return !floor.outerLevel.blockList.some(
        (block) => block.subLevel === null && block.unlockerScene !== null,
      );
    }

    let unsolvedRequirements = 0;
    let current = floor.sceneName;
    const visited = new Set<string>();
    while (!visited.has(current)) {
      visited.add(current);
      const predecessor = incomingLinks.get(current)?.[0];
      if (!predecessor) break;
      current = predecessor.from;
      if (!this.wonLevels.has(current)) unsolvedRequirements++;
    }

    let allowance = 2;
    if (floor.outerLevel.hubAreaName === "Area_Intro") allowance = 0;
    if (
      floor.outerLevel.hubAreaName === "Area_Priority" ||
      floor.outerLevel.hubAreaName === "Area_Extrude" ||
      floor.outerLevel.hubAreaName === "Area_Push"
    ) {
      allowance = 1;
    }
    return unsolvedRequirements <= allowance;
  }

  private configureFastTravel(world: WorldModel): void {
    world.fastTravelFloors.sort(
      (a, b) =>
        b.outerLevel.tempFastTravelY - a.outerLevel.tempFastTravelY,
    );

    let areasWithUnlockedPortals = 0;
    for (const floor of [...world.fastTravelFloors]) {
      const areaHasUnlockedPortal = floor.outerLevel.floorList.some(
        (candidate) =>
          candidate.type === FloorType.LevelPortal && candidate.unlocked,
      );
      if (areaHasUnlockedPortal) areasWithUnlockedPortals++;
      const keep =
        areaHasUnlockedPortal ||
        (floor.outerLevel.hubAreaName === "Area_Reception" &&
          this.nexusUnlocked);
      if (keep) {
        floor.outerLevel.hubShowInTravel = true;
      } else {
        world.removeFloor(floor);
      }
    }

    if (areasWithUnlockedPortals < 3 && !this.nexusUnlocked) {
      for (const floor of [...world.fastTravelFloors]) {
        world.removeFloor(floor);
      }
    }
  }

  private positionPlayerAtRecentPortal(world: WorldModel): void {
    if (!this.recentPuzzle) return;
    const floor = world.floors.find(
      (candidate) =>
        candidate.type === FloorType.LevelPortal &&
        candidate.sceneName === this.recentPuzzle,
    );
    if (!floor) return;

    const offset = findReturnOffset(floor, this.returnOffset);
    this.moveHubPlayer(
      world,
      floor.outerLevel,
      floor.x + offset.dx,
      floor.y + offset.dy,
    );
  }

  private positionPlayerAtRecentArea(world: WorldModel): void {
    if (!this.recentArea) return;
    const level = world.levels.find(
      (candidate) => candidate.hubAreaName === this.recentArea,
    );
    if (!level) return;

    let x = Math.floor(level.width / 2);
    let y = level.height - 2;
    if (level.hubAreaName === "_Demo_End") y = level.height - 3;
    if (level.hubAreaName === "_Area_Tips") y = 1;
    if (level.getBlock(x, y) !== null) return;

    this.moveHubPlayer(world, level, x, y);
  }

  private moveHubPlayer(
    world: WorldModel,
    level: Level,
    x: number,
    y: number,
  ): void {
    const player = world.findPlayerBlock();
    if (player.outerLevel?.getBlock(player.x, player.y) === player) {
      player.outerLevel.setBlock(player.x, player.y, null);
    }
    player.outerLevel = level;
    player.x = x;
    player.y = y;
    player.startOuterLevel = level;
    player.startX = x;
    player.startY = y;
    level.setBlock(x, y, player);
  }
}
