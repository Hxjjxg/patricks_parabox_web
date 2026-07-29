import { describe, expect, it } from "vitest";
import { parseLevel } from "../src/core/levelParser";
import { getLevelSource } from "../src/core/levelRepository";
import { MovementEngine } from "../src/core/movement";

interface LogicSnapshot {
  levelName: string;
  moveCount: number;
  winning: boolean;
  buttonsSatisfied: boolean;
  finishesSatisfied: boolean;
  wentToInfZone: boolean;
  pastCount: number;
  futureCount: number;
  blocks: Array<{
    index: number;
    outer: number;
    sub: number;
    x: number;
    y: number;
    isPlayer: boolean;
    playerOrder: number;
    flipH: boolean;
    movedSinceRestart: boolean;
  }>;
}

interface OriginalLogicSnapshot extends LogicSnapshot {
  requestId: string;
  trace: Array<{
    command: string;
    hash: string;
  }>;
}

const baselineSnapshots = import.meta.glob<OriginalLogicSnapshot>(
  "./fixtures/original/*.json",
  {
    eager: true,
    import: "default",
  },
);
const sweepSnapshots = import.meta.glob<OriginalLogicSnapshot>(
  "./fixtures/original-sweep/*.json",
  {
    eager: true,
    import: "default",
  },
);
const originalSnapshots = {
  ...baselineSnapshots,
  ...(import.meta.env.VITE_RUN_ORIGINAL_SWEEP === "1"
    ? sweepSnapshots
    : {}),
};

function takeSnapshot(
  levelName: string,
  movement: MovementEngine,
): LogicSnapshot {
  const { world, history } = movement;
  world.computeBlockLists();
  world.updateButtonsPressed();

  return {
    levelName,
    moveCount: world.moveCount,
    winning: world.winning,
    buttonsSatisfied: world.buttonsSatisfied,
    finishesSatisfied: world.finishesSatisfied,
    wentToInfZone: world.wentToInfZone,
    pastCount: history.past.length,
    futureCount: history.future.length,
    blocks: world.blocks.map((block, index) => ({
      index,
      outer: block.outerLevel ? world.levels.indexOf(block.outerLevel) : -1,
      sub: block.subLevel ? world.levels.indexOf(block.subLevel) : -1,
      x: block.x,
      y: block.y,
      isPlayer: block.isPlayer,
      playerOrder: block.playerOrder,
      flipH: block.flipH,
      movedSinceRestart: block.movedSinceRestart,
    })),
  };
}

async function computeStateHash(
  levelName: string,
  movement: MovementEngine,
): Promise<string> {
  const snapshot = takeSnapshot(levelName, movement);
  let state = [
    snapshot.levelName,
    snapshot.moveCount,
    snapshot.winning,
    snapshot.buttonsSatisfied,
    snapshot.finishesSatisfied,
    snapshot.wentToInfZone,
    snapshot.pastCount,
    snapshot.futureCount,
  ].join("|");

  for (const block of snapshot.blocks) {
    state += `;${[
      block.outer,
      block.sub,
      block.x,
      block.y,
      block.isPlayer,
      block.playerOrder,
      block.flipH,
      block.movedSinceRestart,
    ].join(",")}`;
  }

  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(state),
  );
  return Array.from(new Uint8Array(digest), (value) =>
    value.toString(16).padStart(2, "0"),
  ).join("");
}

function replayCommand(command: string, movement: MovementEngine): void {
  switch (command) {
    case "LEFT":
      movement.applyDirectionalInput(-1, 0);
      break;
    case "RIGHT":
      movement.applyDirectionalInput(1, 0);
      break;
    case "UP":
      movement.applyDirectionalInput(0, 1);
      break;
    case "DOWN":
      movement.applyDirectionalInput(0, -1);
      break;
    case "UNDO":
      movement.undo();
      break;
    case "REDO":
      movement.redo();
      break;
    case "RESTART":
      movement.restart();
      break;
    default:
      throw new Error(`Unknown original conformance command: ${command}`);
  }
}

describe("original runtime conformance", () => {
  for (const [fixturePath, fixture] of Object.entries(originalSnapshots)) {
    it(`matches ${fixturePath.split("/").at(-1)}`, async () => {
      const world = parseLevel(
        getLevelSource(fixture.levelName),
        fixture.levelName,
      );
      const movement = new MovementEngine(world);

      if (fixture.trace.length === 1) {
        const {
          requestId: _requestId,
          trace: _trace,
          ...expectedInitial
        } = fixture;
        expect(takeSnapshot(fixture.levelName, movement)).toEqual(
          expectedInitial,
        );
      }

      expect(
        await computeStateHash(fixture.levelName, movement),
        `${fixturePath} START`,
      ).toBe(fixture.trace[0]?.hash);

      for (let index = 1; index < fixture.trace.length; index++) {
        const trace = fixture.trace[index];
        if (!trace) throw new Error(`${fixturePath}: missing trace ${index}`);
        replayCommand(trace.command, movement);
        expect(
          await computeStateHash(fixture.levelName, movement),
          `${fixturePath} trace ${index} (${trace.command})`,
        ).toBe(trace.hash);
      }

      const {
        requestId: _requestId,
        trace: _trace,
        ...expected
      } = fixture;
      expect(takeSnapshot(fixture.levelName, movement)).toEqual(expected);
    });
  }
});
