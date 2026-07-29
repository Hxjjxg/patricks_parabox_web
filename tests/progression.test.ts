import { describe, expect, it } from "vitest";
import hubSource from "../src/assets/levels/hub.txt?raw";
import { parseLevel } from "../src/core/levelParser";
import { MovementEngine } from "../src/core/movement";
import { FloorType } from "../src/core/model";
import {
  ProgressionModel,
  puzzleLinks,
  puzzleMetadata,
} from "../src/core/progression";

const portalLevel = `version 4
#
Block -1 -1 0 4 3 0 0 0.8 1 0 0 0 0 0 0 0
\tBlock 1 1 1 1 1 0.9 1 0.7 1 1 1 0 0 0 0 0
\tFloor 2 1 Portal first_puzzle
`;

function portalByName(
  world: ReturnType<typeof parseLevel>,
  sceneName: string,
) {
  const portal = world.floors.find(
    (floor) =>
      floor.type === FloorType.LevelPortal &&
      floor.sceneName === sceneName,
  );
  if (!portal) throw new Error(`Missing hub portal ${sceneName}`);
  return portal;
}

describe("hub progression and portals", () => {
  it("loads the original puzzle metadata and dependency graph", () => {
    expect(puzzleMetadata.size).toBe(364);
    expect(puzzleLinks).toHaveLength(293);
    expect(puzzleMetadata.get("first_puzzle")).toMatchObject({
      hard: 0,
      palette: 0,
      eyesJump: false,
    });
  });

  it("unlocks the same single core frontier in the intro hub area", () => {
    const world = parseLevel(hubSource, "hub");
    const progress = new ProgressionModel();
    progress.applyToHub(world);

    expect(portalByName(world, "first_puzzle").unlocked).toBe(true);
    expect(portalByName(world, "second_puzzle").unlocked).toBe(false);
    expect(portalByName(world, "third_puzzle").unlocked).toBe(false);
    expect(portalByName(world, "enter").unlocked).toBe(false);
    expect(world.fastTravelFloors).toHaveLength(0);
    expect(
      world.levels.flatMap((level) => level.floorList).some(
        (floor) => floor.type === FloorType.FastTravel,
      ),
    ).toBe(false);

    progress.markWon("first_puzzle");
    const refreshedHub = parseLevel(hubSource, "hub");
    progress.applyToHub(refreshedHub);
    expect(portalByName(refreshedHub, "first_puzzle").won).toBe(true);
    expect(portalByName(refreshedHub, "second_puzzle").unlocked).toBe(true);
    expect(portalByName(refreshedHub, "third_puzzle").unlocked).toBe(false);
  });

  it("enables and orders every hub fast-travel stop after full completion", () => {
    const progress = new ProgressionModel({
      wonLevels: [...puzzleMetadata.keys()],
    });
    const world = parseLevel(hubSource, "hub");
    progress.applyToHub(world);

    expect(progress.nexusUnlocked).toBe(true);
    expect(progress.allWon).toBe(true);
    expect(world.fastTravelFloors).toHaveLength(24);
    for (let index = 1; index < world.fastTravelFloors.length; index++) {
      expect(
        world.fastTravelFloors[index - 1]?.outerLevel.tempFastTravelY,
      ).toBeGreaterThanOrEqual(
        world.fastTravelFloors[index]?.outerLevel.tempFastTravelY ?? 0,
      );
    }
    const activeSpecialTypes = world.levels
      .flatMap((level) => level.floorList)
      .map((floor) => floor.type);
    expect(activeSpecialTypes).toContain(FloorType.Smile);
    expect(activeSpecialTypes).toContain(FloorType.Show);
  });

  it("turns an unlocked portal step into a transition without moving history", () => {
    const world = parseLevel(portalLevel, "portal-test");
    const movement = new MovementEngine(world);
    const portal = portalByName(world, "first_puzzle");
    portal.unlocked = true;
    const player = world.findPlayerBlock();

    const result = movement.applyDirectionalInput(1, 0);

    expect(result.moved).toBe(true);
    expect(result.transition?.floor).toBe(portal);
    expect(result.transition).toMatchObject({
      fromX: 1,
      fromY: 1,
      toX: 2,
      toY: 1,
      dx: 1,
      dy: 0,
    });
    expect([player.x, player.y, world.moveCount]).toEqual([1, 1, 0]);
    expect(movement.history.past).toHaveLength(0);
  });

  it("keeps locked portals solid", () => {
    const world = parseLevel(portalLevel, "portal-locked");
    const movement = new MovementEngine(world);

    expect(movement.applyDirectionalInput(1, 0).moved).toBe(false);
    expect([world.findPlayerBlock().x, world.moveCount]).toEqual([1, 0]);
  });

  it("records a confirmed fast-travel relocation as one undoable move", () => {
    const world = parseLevel(portalLevel, "relocation");
    const movement = new MovementEngine(world);
    const player = world.findPlayerBlock();
    const level = player.outerLevel;
    if (!level) throw new Error("Player has no level");
    const origin = { level, x: player.x, y: player.y };

    movement.relocateWithoutHistory(player, level, 1, 2);
    expect([player.x, player.y, world.moveCount]).toEqual([1, 2, 0]);
    expect(movement.history.past).toHaveLength(0);

    movement.commitRelocation(
      player,
      origin.level,
      origin.x,
      origin.y,
    );
    expect(world.moveCount).toBe(1);
    expect(movement.history.past).toHaveLength(1);
    expect(movement.undo()).toBe(true);
    expect([player.x, player.y, world.moveCount]).toEqual([1, 1, 0]);
    expect(movement.redo()).toBe(true);
    expect([player.x, player.y, world.moveCount]).toEqual([1, 2, 1]);
  });

  it("chains a first-time immediate successor and returns beside its hub portal", () => {
    const progress = new ProgressionModel();
    expect(progress.markWon("first_puzzle")).toBe(true);
    expect(progress.nextLevelAfterWin("first_puzzle", true)).toBe(
      "second_puzzle",
    );
    expect(progress.markWon("first_puzzle")).toBe(false);
    expect(progress.nextLevelAfterWin("first_puzzle", false)).toBe("hub");

    const firstHub = parseLevel(hubSource, "hub");
    const firstPuzzlePortal = portalByName(firstHub, "first_puzzle");
    progress.enterPortal(
      firstPuzzlePortal,
      firstPuzzlePortal.x,
      firstPuzzlePortal.y + 1,
    );

    const returnedHub = parseLevel(hubSource, "hub");
    progress.applyToHub(returnedHub);
    const returnedPortal = portalByName(returnedHub, "first_puzzle");
    const player = returnedHub.findPlayerBlock();
    expect(player.outerLevel).toBe(returnedPortal.outerLevel);
    expect([player.x, player.y]).toEqual([
      returnedPortal.x,
      returnedPortal.y + 1,
    ]);
    expect(player.startOuterLevel).toBe(player.outerLevel);
    expect([player.startX, player.startY]).toEqual([player.x, player.y]);
  });

  it("persists the recent hub area but keeps portal return data session-only", () => {
    const progress = new ProgressionModel();
    progress.setRecentArea("Area_Enter");
    progress.recentPuzzle = "first_puzzle";
    progress.returnOffset = { dx: 1, dy: 0 };

    const snapshot = progress.serialize();
    expect(snapshot).toMatchObject({
      version: 3,
      recentArea: "Area_Enter",
      nexusUnlocked: false,
      playtimeSeconds: 0,
    });
    expect(snapshot).not.toHaveProperty("recentPuzzle");
    expect(snapshot).not.toHaveProperty("returnOffset");

    const restored = new ProgressionModel(snapshot);
    expect(restored.recentPuzzle).toBeNull();
    const hub = parseLevel(hubSource, "hub");
    restored.applyToHub(hub);
    const area = hub.levels.find(
      (level) => level.hubAreaName === "Area_Enter",
    );
    if (!area) throw new Error("Missing Area_Enter");
    const player = hub.findPlayerBlock();
    expect(player.outerLevel).toBe(area);
    expect([player.x, player.y]).toEqual([
      Math.floor(area.width / 2),
      area.height - 2,
    ]);
  });

  it("accumulates finite positive focused playtime in the snapshot", () => {
    const progress = new ProgressionModel({ playtimeSeconds: 10 });
    progress.addPlaytime(0.25);
    progress.addPlaytime(-1);
    progress.addPlaytime(Number.NaN);

    expect(progress.playtimeSeconds).toBe(10.25);
    expect(progress.serialize().playtimeSeconds).toBe(10.25);
  });

  it("stores final nexus access separately from winning the last puzzle", () => {
    const progress = new ProgressionModel({
      wonLevels: ["iii"],
      nexusUnlocked: false,
    });
    expect(progress.nexusUnlocked).toBe(false);
    expect(progress.unlockNexus()).toBe(true);
    expect(progress.unlockNexus()).toBe(false);
    expect(progress.serialize().nexusUnlocked).toBe(true);
  });

  it("keeps the Hub ending locked until the final iii portal is won", () => {
    const hub = parseLevel(hubSource, "hub");
    const progress = new ProgressionModel();
    progress.applyToHub(hub);
    const finish = hub.floors.find(
      (floor) => floor.type === FloorType.PlayerButton,
    );
    if (!finish) throw new Error("Missing Hub finish");
    const player = hub.findPlayerBlock();
    const startLevel = player.outerLevel;
    if (!startLevel) throw new Error("Hub player has no outer level");
    startLevel.setBlock(player.x, player.y, null);
    player.outerLevel = finish.outerLevel;
    player.x = finish.x;
    player.y = finish.y;
    finish.outerLevel.setBlock(finish.x, finish.y, player);
    hub.computeBlockLists();

    hub.updateButtonsPressed();
    expect(hub.finishesSatisfied).toBe(true);
    expect(hub.buttonsSatisfied).toBe(false);

    portalByName(hub, "iii").won = true;
    hub.updateButtonsPressed();
    expect(hub.buttonsSatisfied).toBe(true);
  });

  it("consumes the post-credits Hub return position exactly once", () => {
    const templateHub = parseLevel(hubSource, "hub");
    const finish = templateHub.floors.find(
      (floor) => floor.type === FloorType.PlayerButton,
    );
    if (!finish) throw new Error("Missing Hub finish");
    const returnX = finish.x;
    const returnY = finish.y - 1;
    const areaName = finish.outerLevel.hubAreaName;
    const progress = new ProgressionModel();
    progress.setHubReturnPosition(areaName, returnX, returnY);

    const firstHub = parseLevel(hubSource, "hub");
    progress.applyToHub(firstHub);
    const firstPlayer = firstHub.findPlayerBlock();
    expect(firstPlayer.outerLevel?.hubAreaName).toBe(areaName);
    expect([firstPlayer.x, firstPlayer.y]).toEqual([returnX, returnY]);

    const secondHub = parseLevel(hubSource, "hub");
    progress.applyToHub(secondHub);
    const center = secondHub.levels.find(
      (level) => level.hubAreaName === areaName,
    );
    if (!center) throw new Error(`Missing ${areaName}`);
    const secondPlayer = secondHub.findPlayerBlock();
    expect(secondPlayer.outerLevel).toBe(center);
    expect([secondPlayer.x, secondPlayer.y]).toEqual([
      Math.floor(center.width / 2),
      center.height - 2,
    ]);
  });
});
