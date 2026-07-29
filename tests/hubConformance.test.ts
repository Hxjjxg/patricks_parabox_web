import { describe, expect, it } from "vitest";
import hubSource from "../src/assets/levels/hub.txt?raw";
import { parseLevel } from "../src/core/levelParser";
import { Block, Floor, FloorType, WorldModel } from "../src/core/model";
import { ProgressionModel } from "../src/core/progression";

interface HubPortalSnapshot {
  scene: string;
  area: string;
  x: number;
  y: number;
  won: boolean;
  unlocked: boolean;
  hard: number;
}

interface HubWallSnapshot {
  area: string;
  x: number;
  y: number;
  unlocker: string;
}

interface HubFloorSnapshot {
  type: string;
  area: string;
  x: number;
  y: number;
  info?: string;
}

interface HubPositionSnapshot {
  area: string;
  x: number;
  y: number;
}

interface HubLogicSnapshot {
  levelName: "hub";
  nexusUnlocked: boolean;
  allWon: boolean;
  recentArea: string | null;
  wonLevels: string[];
  player: HubPositionSnapshot;
  portals: HubPortalSnapshot[];
  walls: HubWallSnapshot[];
  fastTravel: HubPositionSnapshot[];
  specialFloors: HubFloorSnapshot[];
  shortcutAreas: string[];
}

interface OriginalHubLogicSnapshot extends HubLogicSnapshot {
  requestId: string;
  kind: "hub";
}

const originalHubSnapshots =
  import.meta.glob<OriginalHubLogicSnapshot>(
    "./fixtures/original-hub/*.json",
    {
      eager: true,
      import: "default",
    },
  );

const specialFloorNames = new Map<FloorType, string>([
  [FloorType.Info, "Info"],
  [FloorType.BreakFloor, "BreakFloor"],
  [FloorType.GalleryFloor, "GalleryFloor"],
  [FloorType.Smile, "Smile"],
  [FloorType.Show, "Show"],
]);

const specialFloorOrder = new Map<string, number>([
  ["Info", 3],
  ["BreakFloor", 6],
  ["GalleryFloor", 8],
  ["Smile", 10],
  ["Show", 11],
]);

function compareAreaPosition(
  a: { area: string; x: number; y: number },
  b: { area: string; x: number; y: number },
): number {
  return (
    compareOrdinal(a.area, b.area) ||
    a.x - b.x ||
    a.y - b.y
  );
}

function compareOrdinal(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function isActiveFloor(floor: Floor): boolean {
  return floor.outerLevel.getFloor(floor.x, floor.y) === floor;
}

function isActiveWall(block: Block): boolean {
  return (
    block.subLevel === null &&
    block.unlockerScene !== null &&
    block.outerLevel?.getBlock(block.x, block.y) === block
  );
}

function takeHubSnapshot(
  world: WorldModel,
  progress: ProgressionModel,
): HubLogicSnapshot {
  const player = world.findPlayerBlock();
  if (!player.outerLevel) throw new Error("Hub player has no outer level");

  const portals = world.floors
    .filter((floor) => floor.type === FloorType.LevelPortal)
    .map((floor) => ({
      scene: floor.sceneName,
      area: floor.outerLevel.hubAreaName,
      x: floor.x,
      y: floor.y,
      won: floor.won,
      unlocked: floor.unlocked,
      hard: floor.hard,
    }))
    .sort((a, b) => compareOrdinal(a.scene, b.scene));

  const walls = world.blocks
    .filter(isActiveWall)
    .map((block) => ({
      area: block.outerLevel?.hubAreaName ?? "",
      x: block.x,
      y: block.y,
      unlocker: block.unlockerScene ?? "",
    }))
    .sort(
      (a, b) =>
        compareAreaPosition(a, b) ||
        compareOrdinal(a.unlocker, b.unlocker),
    );

  const fastTravel = world.fastTravelFloors.map((floor) => ({
    area: floor.outerLevel.hubAreaName,
    x: floor.x,
    y: floor.y,
  }));

  const specialFloors = world.floors
    .filter(isActiveFloor)
    .flatMap((floor): HubFloorSnapshot[] => {
      const type = specialFloorNames.get(floor.type);
      if (!type) return [];
      const snapshot: HubFloorSnapshot = {
        type,
        area: floor.outerLevel.hubAreaName,
        x: floor.x,
        y: floor.y,
      };
      if (floor.type === FloorType.Info) {
        snapshot.info = floor.infoKey;
      }
      return [snapshot];
    })
    .sort(
      (a, b) =>
        compareOrdinal(a.area, b.area) ||
        (specialFloorOrder.get(a.type) ?? 0) -
          (specialFloorOrder.get(b.type) ?? 0) ||
        a.x - b.x ||
        a.y - b.y,
    );

  return {
    levelName: "hub",
    nexusUnlocked: progress.nexusUnlocked,
    allWon: progress.allWon,
    recentArea: progress.recentArea,
    wonLevels: [...progress.wonLevels].sort(),
    player: {
      area: player.outerLevel.hubAreaName,
      x: player.x,
      y: player.y,
    },
    portals,
    walls,
    fastTravel,
    specialFloors,
    shortcutAreas: world.levels
      .filter((level) => level.hubShortcutWon)
      .map((level) => level.hubAreaName)
      .sort(compareOrdinal),
  };
}

describe("original Hub progression conformance", () => {
  for (const [fixturePath, fixture] of Object.entries(
    originalHubSnapshots,
  )) {
    it(`matches ${fixturePath.split("/").at(-1)}`, () => {
      const progress = new ProgressionModel({
        wonLevels: fixture.wonLevels,
        recentArea: fixture.recentArea,
        nexusUnlocked: fixture.nexusUnlocked,
      });
      const world = parseLevel(hubSource, "hub");
      progress.applyToHub(world);

      const {
        requestId: _requestId,
        kind: _kind,
        ...expected
      } = fixture;
      expect(takeHubSnapshot(world, progress)).toEqual(expected);
    });
  }
});
